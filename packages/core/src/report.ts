import { MethodComplexity } from './types';
import { VUE_SCRIPT, PRISM_CSS, PRISM_SCRIPT } from './assets';

export interface FileAnalysisResult {
    path: string;
    content: string;
    methods: MethodComplexity[];
    totalScore: number;
}

export interface ProjectAnalysisResult {
    files: FileAnalysisResult[];
    totalScore: number;
}

interface TreeNode {
    id: string;
    name: string;
    fullPath: string;
    type: 'file' | 'folder' | 'method';
    score: number;
    children?: TreeNode[];
    methods?: MethodComplexity[];
    // For UI state (not strictly part of the data model, but useful to initialize)
    isExpanded?: boolean;
}

export function generateHtmlReport(result: ProjectAnalysisResult): string {
    const date = new Date().toLocaleString();

    // We construct the tree on the server side (Node) to pass a clean JSON structure to Vue
    const tree = buildFileTree(result.files);

    // Escape the JSON to prevent XSS or breaking the script tag
    const projectDataStr = JSON.stringify(result.files).replace(/</g, '\\u003c');
    const treeDataStr = JSON.stringify(tree).replace(/</g, '\\u003c');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cognitive Complexity Report</title>
    <style>
        ${PRISM_CSS}
        :root {
            --bg-color: #f8fafc;
            --sidebar-bg: #ffffff;
            --border-color: #e2e8f0;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --primary: #2563eb;
            --error: #ef4444;
            --warning: #f59e0b;
            --success: #10b981;
            --code-bg: #ffffff;
            --tree-hover: #f1f5f9;
            --tree-selected: #eff6ff;
        }

        body { 
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            margin: 0; 
            height: 100vh; 
            display: flex; 
            flex-direction: column;
            color: var(--text-main);
            background: var(--bg-color);
            overflow: hidden;
        }

        #app {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }

        /* Layout */
        header {
            height: 60px;
            background: #1e293b;
            color: white;
            display: flex;
            align-items: center;
            padding: 0 20px;
            justify-content: space-between;
            flex-shrink: 0;
        }

        .main-container {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        .sidebar {
            width: 350px;
            background: var(--sidebar-bg);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--code-bg);
            overflow: hidden;
        }

        /* Sidebar Components */
        .sidebar-header {
            padding: 12px;
            border-bottom: 1px solid var(--border-color);
            background: #f8fafc;
        }

        .search-box {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 0.85rem;
            outline: none;
        }
        .search-box:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1); }

        .tree-container {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
        }

        /* Tree Item Styles */
        .tree-item {
            display: flex;
            align-items: center;
            padding: 4px 12px;
            cursor: pointer;
            font-size: 0.85rem;
            white-space: nowrap;
            user-select: none;
        }
        .tree-item:hover { background: var(--tree-hover); }
        .tree-item.active { background: var(--tree-selected); color: var(--primary); font-weight: 500; }

        .tree-expander {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 4px;
            color: var(--text-muted);
            font-size: 0.7rem;
            transition: transform 0.1s;
        }
        .tree-expander.expanded { transform: rotate(90deg); }
        .invisible { visibility: hidden; }

        .score-badge {
            margin-left: auto;
            font-size: 0.75rem; 
            font-weight: 600; 
            padding: 1px 6px; 
            border-radius: 10px;
        }
        .score-high { background: #fee2e2; color: #b91c1c; }
        .score-med { background: #ffedd5; color: #9a3412; }
        .score-low { background: #dcfce7; color: #15803d; }

        /* Code View */
        .content-header {
            padding: 12px 20px;
            border-bottom: 1px solid var(--border-color);
            background: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }

        .code-container {
            flex: 1;
            overflow: auto;
            position: relative;
            font-size: 13px;
        }

        /* Prism Overrides / Line Highlighting */
        /* IMPORTANT: Force line-height to 20px to match annotation calculation */
        pre[class*="language-"] {
            margin: 0 !important;
            padding: 20px !important;
            background: transparent !important;
            line-height: 20px !important;
        }

        code[class*="language-"] {
            line-height: 20px !important;
        }

        /* Line Numbers & Highlighting Logic */
        .code-wrapper {
            position: relative;
        }

        .line-highlight {
            position: absolute;
            left: 0;
            right: 0;
            background: rgba(255, 247, 237, 0.5); /* #fff7ed */
            pointer-events: none;
            z-index: 0;
        }

        /* Annotation Badges overlaying code */
        .annotation-marker {
            position: absolute;
            right: 20px;
            background: #fee2e2;
            border: 1px solid #fecaca;
            color: #991b1b;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            line-height: 1.2;
            z-index: 10;
            pointer-events: auto;
            cursor: help;
        }

        /* Modal */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            padding-top: 10vh;
            z-index: 200;
        }
        .modal {
            background: white;
            width: 600px;
            max-width: 90%;
            max-height: 80vh;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }
        .modal-input {
            padding: 16px;
            font-size: 16px;
            border: none;
            border-bottom: 1px solid var(--border-color);
            outline: none;
        }
        .modal-results {
            flex: 1;
            overflow-y: auto;
        }
        .result-item {
            padding: 10px 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            border-bottom: 1px solid #f1f5f9;
        }
        .result-item.selected { background: var(--tree-selected); }
        .result-info { flex: 1; overflow: hidden; }
        .result-name { font-weight: 500; font-size: 14px; }
        .result-path { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }

        .offline-warning {
            padding: 20px;
            text-align: center;
            color: #ef4444;
            display: none;
        }
    </style>
</head>
<body>
    <div id="app">
        <header>
            <div style="display: flex; align-items: center; gap: 12px;">
                <h1 style="font-size: 1.2rem; margin: 0;">Cognitive Lens Report</h1>
                <span style="font-size: 0.75rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">Ctrl+K</span>
            </div>
            <div style="display: flex; gap: 20px; font-size: 0.9rem;">
                <div>Files: <span style="color: #38bdf8; font-weight: bold;">{{ stats.fileCount }}</span></div>
                <div>Total: <span style="color: #38bdf8; font-weight: bold;">{{ stats.totalScore }}</span></div>
                <div style="color: #94a3b8; font-size: 0.75rem;">{{ stats.date }}</div>
            </div>
        </header>

        <div class="main-container">
            <div class="sidebar">
                <div class="sidebar-header">
                    <input v-model="filterQuery" class="search-box" placeholder="Filter tree..." />
                </div>
                <div class="tree-container">
                    <tree-node
                        v-for="child in filteredTree"
                        :key="child.id"
                        :node="child"
                        :depth="0"
                        :version="treeVersion"
                        :active-id="activeNodeId"
                        @select="selectNode"
                    ></tree-node>
                </div>
            </div>

            <div class="content">
                <div class="content-header">
                    <div style="font-family: monospace; color: var(--text-muted);">{{ currentFilePath || 'Select a file or method' }}</div>
                    <div v-if="selectedMethod" :class="['score-badge', getScoreClass(selectedMethod.score)]">
                        {{ selectedMethod.score }} Complexity
                    </div>
                </div>
                <div class="code-container" ref="codeContainer">
                    <div v-if="!currentFileContent" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8;">
                        <div style="text-align: center;">
                            <p>Select a method to view code</p>
                        </div>
                    </div>
                    <div v-else class="code-wrapper">
                        <!-- Annotations Layer -->
                        <div v-for="ann in currentAnnotations"
                             :style="{ top: (ann.line * 20 + 20) + 'px' }"
                             class="annotation-marker"
                             :title="ann.message">
                            +{{ ann.score }} {{ ann.shortMsg }}
                        </div>

                        <!-- Syntax Highlighted Code -->
                        <pre class="line-numbers" :class="'language-' + currentLanguage"><code v-html="highlightedCode"></code></pre>
                    </div>
                </div>
            </div>
        </div>

        <!-- Search Modal -->
        <div v-if="showSearch" class="modal-overlay" @click="closeSearch">
            <div class="modal" @click.stop>
                <input ref="searchInput" v-model="searchQuery" class="modal-input" placeholder="Search files and methods..." @keydown.down.prevent="moveSelection(1)" @keydown.up.prevent="moveSelection(-1)" @keydown.enter="selectSearchResult" @keydown.esc="closeSearch">
                <div class="modal-results">
                    <div v-for="(res, idx) in searchResults"
                         :key="idx"
                         class="result-item"
                         :class="{ selected: idx === selectedResultIndex }"
                         @click="selectResult(res)"
                         @mouseenter="selectedResultIndex = idx">
                        <span style="margin-right: 10px; font-size: 1.2rem;">{{ res.type === 'file' ? '📄' : 'ƒ' }}</span>
                        <div class="result-info">
                            <div class="result-name">{{ res.name }}</div>
                            <div class="result-path">{{ res.path }}</div>
                        </div>
                        <span :class="['score-badge', getScoreClass(res.score)]">{{ res.score }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script>${VUE_SCRIPT}</script>
    <script>${PRISM_SCRIPT}</script>

    <script>
        const { createApp, ref, computed, onMounted, nextTick, shallowRef, triggerRef, watch } = Vue;

        // Data from Server
        const projectFiles = ${projectDataStr};
        const initialTree = ${treeDataStr};
        const generatedDate = "${date}";

        // --- Components ---

        const TreeNode = {
            name: 'TreeNode',
            props: ['node', 'depth', 'forceExpand', 'activeId', 'version'],
            template: \`
                <div class="tree-node-wrapper">
                    <div class="tree-item" :class="{ active: isActive }" :style="{ paddingLeft: (depth * 16 + 8) + 'px' }" @click="handleClick">
                        <span
                            class="tree-expander"
                            :class="{ expanded: isExpanded, invisible: !hasChildren }"
                            @click.stop="toggleExpand"
                        >▶</span>
                        <span style="margin-right: 6px;">{{ icon }}</span>
                        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">{{ node.name }}</span>
                        <span v-if="node.score > 0" :class="['score-badge', scoreClass]">{{ node.score }}</span>
                    </div>

                    <div v-if="isExpanded && hasChildren">
                         <!-- Folders and Files (mixed/sorted) -->
                        <tree-node
                            v-for="child in sortedChildren"
                            :key="child.id"
                            :node="child"
                            :depth="depth + 1"
                            :active-id="activeId"
                            :version="version"
                            @select="$emit('select', $event)"
                        ></tree-node>
                        <!-- Methods (if any directly on this node) -->
                        <tree-node
                            v-for="method in sortedMethods"
                            :key="method.id"
                            :node="method"
                            :depth="depth + 1"
                            :active-id="activeId"
                            :version="version"
                            @select="$emit('select', $event)"
                        ></tree-node>
                    </div>
                </div>
            \`,
            setup(props, { emit }) {
                // Computed dependent on version to force update
                const isExpanded = computed(() => {
                    return props.version >= 0 && !!props.node.isExpanded;
                });

                const hasChildren = computed(() => {
                    return (props.node.children && props.node.children.length > 0) ||
                           (props.node.methods && props.node.methods.length > 0);
                });

                const icon = computed(() => {
                    if (props.node.type === 'folder') return '📁';
                    if (props.node.type === 'file') return '📄';
                    return 'ƒ';
                });

                const scoreClass = computed(() => {
                    const s = props.node.score;
                    if (s >= 25) return 'score-high';
                    if (s >= 15) return 'score-med';
                    return 'score-low';
                });

                const sortedChildren = computed(() => {
                    if (!props.node.children) return [];
                    return props.node.children.slice().sort((a, b) => {
                        // Folders first
                        if (a.type !== b.type) {
                            if (a.type === 'folder') return -1;
                            if (b.type === 'folder') return 1;
                        }
                        // Then by score desc
                        return b.score - a.score;
                    });
                });

                const sortedMethods = computed(() => {
                    if (!props.node.methods) return [];
                    return props.node.methods
                        .slice()
                        .sort((a, b) => b.score - a.score)
                        .map(m => ({
                            id: 'method-' + m.name + '-' + m.startLine,
                            name: m.name,
                            type: 'method',
                            score: m.score,
                            fullPath: props.node.fullPath,
                            methodData: m
                        }));
                });

                const isActive = computed(() => {
                    return props.activeId === props.node.id;
                });

                function toggleExpand() {
                    if (hasChildren.value) {
                        props.node.isExpanded = !props.node.isExpanded;
                        emit('select', { node: props.node, type: 'toggle' });
                    }
                }

                function handleClick() {
                    if (props.node.type === 'method') {
                        emit('select', { node: props.node, type: 'method' });
                    } else {
                        toggleExpand();
                        if (props.node.type === 'file') {
                            emit('select', { node: props.node, type: 'file' });
                        }
                    }
                }

                return { isExpanded, hasChildren, icon, scoreClass, sortedChildren, sortedMethods, toggleExpand, handleClick, isActive };
            }
        };

        // --- Main App ---

        const app = createApp({
            components: { TreeNode },
            setup() {
                // State
                const treeRoot = shallowRef(initialTree);
                const treeVersion = ref(0);
                const nodeMap = new Map(); // Flat map for O(1) access

                // Initialize Map
                function indexNodes(node) {
                    nodeMap.set(node.fullPath, node);
                    if (node.children) node.children.forEach(indexNodes);
                }
                // Root children are the top level
                if (treeRoot.value.children) {
                    treeRoot.value.children.forEach(indexNodes);
                }

                const filterQuery = ref('');
                const searchQuery = ref('');
                const showSearch = ref(false);
                const selectedResultIndex = ref(0);
                const searchInput = ref(null);
                const activeNodeId = ref('');

                const currentFilePath = ref('');
                const currentFileContent = ref('');
                const currentLanguage = ref('typescript');
                const selectedMethod = ref(null);
                const currentAnnotations = ref([]);

                // Computed
                const stats = {
                    fileCount: projectFiles.length,
                    totalScore: projectFiles.reduce((acc, f) => acc + f.totalScore, 0),
                    date: generatedDate
                };

                const filteredTree = computed(() => {
                    if (!filterQuery.value) return sortNodes(treeRoot.value.children || []);
                    return filterNodes(treeRoot.value.children || [], filterQuery.value.toLowerCase());
                });

                const searchResults = computed(() => {
                    if (!searchQuery.value) return [];
                    const q = searchQuery.value.toLowerCase();
                    const results = [];

                    projectFiles.forEach(f => {
                        if (f.path.toLowerCase().includes(q)) {
                             // O(1) lookup
                             const node = nodeMap.get(f.path);
                             if (node) {
                                results.push({
                                    name: f.path.split('/').pop(),
                                    path: f.path,
                                    score: f.totalScore,
                                    type: 'file',
                                    id: node.id
                                });
                             }
                        }
                        f.methods.forEach(m => {
                            if (m.name.toLowerCase().includes(q)) {
                                results.push({ name: m.name, path: f.path, score: m.score, type: 'method', methodData: m });
                            }
                        });
                    });

                    // Sort by score desc
                    return results.sort((a, b) => b.score - a.score).slice(0, 50);
                });

                const highlightedCode = computed(() => {
                    if (!currentFileContent.value) return '';
                    if (window.Prism) {
                        try {
                            const grammar = Prism.languages[currentLanguage.value] || Prism.languages.javascript;
                            const html = Prism.highlight(currentFileContent.value, grammar, currentLanguage.value);
                            // Wrap in a div to allow Prism plugin to process it?
                            // Prism.highlight returns string HTML.
                            // The line-numbers plugin usually runs on 'complete' hook or DOMContentLoaded.
                            // Since we are using Vue, we need to trigger it manually or let the plugin run.
                            // The plugin observes DOM additions or we can call Prism.highlightElement manually.
                            return html;
                        } catch (e) {
                            console.error(e);
                            return escapeHtml(currentFileContent.value);
                        }
                    }
                    return escapeHtml(currentFileContent.value);
                });

                // Trigger Prism line numbers after update
                watch(highlightedCode, () => {
                    nextTick(() => {
                        if (window.Prism) {
                            // We need to re-run Prism on the code block to generate line numbers
                            // Or better: use Prism.highlightElement which handles plugins.
                            // But highlightedCode is computed string.
                            // The line-numbers plugin listens to 'complete' hook of highlightElement.
                            // If we just inject HTML, the plugin doesn't know.
                            // We need to manually invoke the plugin or use highlightElement on the ref.

                            // Hack: Prism line-numbers plugin exposes a resize method but also runs on complete.
                            // Let's try to just select all pre.line-numbers and running Prism.highlightElement is redundant if we already highlighted.
                            // Actually, if we use Prism.highlight (string), plugins are NOT applied automatically to the string.
                            // We need to use Prism.highlightElement on the mounted DOM element.
                            // So we should NOT use v-html with Prism.highlight string if we want plugins.
                            // We should use a watcher and ref to call highlightElement.

                            // Refactor:
                            // We will inject the raw code into <code> and then call Prism.highlightElement.
                            // But we are using v-html="highlightedCode".
                            // Let's change the strategy in the template?
                            // Or just manually run the line-numbers logic?
                            // Prism.plugins.lineNumbers.resize(preElement) might work if structure is there.

                            // Simpler: Just re-highlight the element.
                            const codeEl = document.querySelector('pre.line-numbers code');
                            if (codeEl) {
                                // Reset content to raw to let Prism handle it?
                                // Or does Prism.highlightElement work on already highlighted code? No.
                                // It expects text content.

                                // Let's just manually invoke the line number generation logic which adds the spans.
                                // Prism.plugins.lineNumbers.resize is exposed.
                                Prism.plugins.lineNumbers.resize(codeEl.parentElement);
                            }
                        }
                    });
                });

                // Helper to expand path to node
                function expandPathToNode(node, targetPath) {
                    // This function mutates the tree structure
                    let modified = false;
                    if (node.fullPath && targetPath.startsWith(node.fullPath)) {
                        if (!node.isExpanded) {
                            node.isExpanded = true;
                            modified = true;
                        }
                    }
                    if (node.children) {
                        for (const child of node.children) {
                            if (expandPathToNode(child, targetPath)) modified = true;
                        }
                    }
                    return modified;
                }

                // Methods
                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }

                function sortNodes(nodes) {
                    return nodes.slice().sort((a, b) => {
                         if (a.type !== b.type) {
                            if (a.type === 'folder') return -1;
                            if (b.type === 'folder') return 1;
                        }
                        return b.score - a.score;
                    });
                }

                function filterNodes(nodes, query) {
                    return nodes.map(node => {
                        const matches = node.name.toLowerCase().includes(query);
                        let children = [];
                        if (node.children) children = filterNodes(node.children, query);
                        let methods = [];
                        if (node.methods) methods = node.methods.filter(m => m.name.toLowerCase().includes(query));
                        if (matches || children.length > 0 || methods.length > 0) {
                            return {
                                ...node,
                                children: sortNodes(children),
                                methods,
                                forceExpand: true,
                                isExpanded: true
                            };
                        }
                        return null;
                    }).filter(Boolean);
                }

                function getScoreClass(score) {
                    if (score >= 25) return 'score-high';
                    if (score >= 15) return 'score-med';
                    return 'score-low';
                }

                function selectNode(event) {
                    const { node, type } = event;

                    if (type === 'toggle') {
                        // Force update version
                        treeVersion.value++;
                        triggerRef(treeRoot);
                        return;
                    }

                    const file = projectFiles.find(f => f.path === node.fullPath);
                    if (!file) return;

                    activeNodeId.value = node.id;

                    // Expand path
                    if (expandPathToNode(treeRoot.value, node.fullPath)) {
                        treeVersion.value++;
                        triggerRef(treeRoot); // Force update
                    }

                    currentFilePath.value = node.fullPath;
                    currentFileContent.value = file.content;

                    const ext = node.fullPath.split('.').pop();
                    if (ext === 'cs') currentLanguage.value = 'csharp';
                    else if (ext === 'tsx') currentLanguage.value = 'tsx';
                    else if (ext === 'jsx') currentLanguage.value = 'jsx';
                    else currentLanguage.value = 'typescript';

                    if (type === 'method' && node.methodData) {
                        selectedMethod.value = node.methodData;
                        currentAnnotations.value = node.methodData.details.map(d => ({
                            line: d.line,
                            score: d.score,
                            message: d.message,
                            shortMsg: d.message.replace(/\\(incl \\d+ for nesting\\)/, '').trim()
                        }));

                        nextTick(() => {
                            const container = document.querySelector('.code-container');
                            const line = node.methodData.startLine;
                            if (container) {
                                container.scrollTop = line * 20;
                            }
                        });
                    } else if (type === 'file') {
                        if (file.methods && file.methods.length > 0) {
                            const sortedMethods = file.methods.slice().sort((a, b) => b.score - a.score);
                            const firstMethod = sortedMethods[0];

                            selectedMethod.value = firstMethod;
                            currentAnnotations.value = firstMethod.details.map(d => ({
                                line: d.line,
                                score: d.score,
                                message: d.message,
                                shortMsg: d.message.replace(/\\(incl \\d+ for nesting\\)/, '').trim()
                            }));

                            nextTick(() => {
                                const container = document.querySelector('.code-container');
                                if (container) {
                                    container.scrollTop = firstMethod.startLine * 20;
                                }
                            });
                        } else {
                             selectedMethod.value = null;
                             currentAnnotations.value = [];
                             nextTick(() => {
                                const container = document.querySelector('.code-container');
                                if (container) container.scrollTop = 0;
                            });
                        }
                    }
                }

                function openSearch() {
                    showSearch.value = true;
                    searchQuery.value = '';
                    selectedResultIndex.value = 0;
                    nextTick(() => searchInput.value?.focus());
                }

                function closeSearch() {
                    showSearch.value = false;
                }

                function moveSelection(dir) {
                    const max = searchResults.value.length - 1;
                    let next = selectedResultIndex.value + dir;
                    if (next < 0) next = 0;
                    if (next > max) next = max;
                    selectedResultIndex.value = next;
                }

                function selectResult(res) {
                    closeSearch();
                    if (res.type === 'file') {
                         selectNode({
                            node: {
                                id: res.id,
                                name: res.name,
                                fullPath: res.path,
                                type: 'file',
                                score: res.score,
                            },
                            type: 'file'
                        });
                    } else {
                        const methodId = 'method-' + res.methodData.name + '-' + res.methodData.startLine;
                        selectNode({
                            node: {
                                id: methodId,
                                fullPath: res.path,
                                methodData: res.methodData,
                            },
                            type: 'method'
                        });
                    }
                }

                function selectSearchResult() {
                    const res = searchResults.value[selectedResultIndex.value];
                    if (res) selectResult(res);
                }

                window.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                        e.preventDefault();
                        openSearch();
                    }
                });

                return {
                    stats,
                    treeRoot,
                    filteredTree,
                    treeVersion,
                    filterQuery,
                    searchQuery,
                    showSearch,
                    searchResults,
                    selectedResultIndex,
                    searchInput,
                    currentFilePath,
                    currentFileContent,
                    currentLanguage,
                    highlightedCode,
                    selectedMethod,
                    currentAnnotations,
                    getScoreClass,
                    selectNode,
                    openSearch,
                    closeSearch,
                    moveSelection,
                    selectResult,
                    selectSearchResult,
                    activeNodeId
                };
            }
        });

        app.mount('#app');
    </script>
</body>
</html>
    `;
}

function buildFileTree(files: FileAnalysisResult[]): TreeNode {
    const root: TreeNode = {
        id: 'root',
        name: 'root',
        fullPath: '',
        type: 'folder',
        score: 0,
        children: []
    };

    let idCounter = 0;
    const map = new Map<string, TreeNode>();
    map.set('', root);

    // Build tree
    for (const file of files) {
        const parts = file.path.split('/');
        let currentPath = '';
        let parent = root;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const nextPath = currentPath ? `${currentPath}/${part}` : part;

            if (!map.has(nextPath)) {
                const newFolder: TreeNode = {
                    id: `dir-${idCounter++}`,
                    name: part,
                    fullPath: nextPath,
                    type: 'folder',
                    score: 0,
                    children: []
                };
                map.set(nextPath, newFolder);
                parent.children!.push(newFolder);
            }
            parent = map.get(nextPath)!;
            currentPath = nextPath;
        }

        const fileName = parts[parts.length - 1];
        parent.children!.push({
            id: `file-${idCounter++}`,
            name: fileName,
            fullPath: file.path,
            type: 'file',
            score: file.totalScore,
            children: [],
            methods: file.methods.filter(m => !m.isCallback)
        });
    }

    // Calculate scores
    function calcScore(node: TreeNode): number {
        if (node.type === 'file') return node.score;
        let total = 0;
        if (node.children) {
            for (const child of node.children) {
                total += calcScore(child);
            }
        }
        node.score = total;
        return total;
    }
    calcScore(root);

    return root;
}
