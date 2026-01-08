import { strToU8, zlibSync } from 'fflate';
// Assets are now loaded via CDN in the generated HTML

export interface FileAnalysisResult {
  path: string;
  content: string;
  methods: any[];
  totalScore: number;
}

export interface ProjectAnalysisResult {
  files: FileAnalysisResult[];
  totalScore: number;
  favicon?: string;
}

interface TreeNode {
  id: string;
  name: string;
  fullPath: string;
  type: 'file' | 'folder' | 'method';
  score: number;
  children?: TreeNode[];
  methods?: any[];
  // For UI state (not strictly part of the data model, but useful to initialize)
  isExpanded?: boolean;
}

export function generateHtmlReport(result: ProjectAnalysisResult): string {
  const date = new Date().toLocaleString();

  // We construct the tree on the server side (Node) to pass a clean JSON structure to Vue
  const tree = buildFileTree(result.files);

  // Compress project files and tree to reduce report size
  const projectFilesBuf = strToU8(JSON.stringify(result.files));
  const compressedProjectFiles = zlibSync(projectFilesBuf, { level: 9 });
  const projectFilesBase64 = Buffer.from(compressedProjectFiles).toString('base64');

  const treeBuf = strToU8(JSON.stringify(tree));
  const compressedTree = zlibSync(treeBuf, { level: 9 });
  const treeBase64 = Buffer.from(compressedTree).toString('base64');

  return /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cognitive Complexity Report</title>
    <link rel="icon" type="image/png" href="${result.favicon || ''}">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css">
    <style>
        :root {
            --bg-color: #f8fafc;
            --sidebar-bg: #ffffff;
            --sidebar-header-bg: #f8fafc;
            --content-header-bg: #ffffff;
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
            --header-bg: #1e293b;
            --header-text: #ffffff;
            --modal-bg: #ffffff;
            --modal-shadow: rgba(0,0,0,0.1);
            --match-highlight: #fde68a;
            --inlay-bg: #fee2e2;
            --inlay-border: #fecaca;
            --inlay-text: #991b1b;
            --score-high-bg: #fee2e2;
            --score-high-text: #b91c1c;
            --score-med-bg: #ffedd5;
            --score-med-text: #9a3412;
            --score-low-bg: #dcfce7;
            --score-low-text: #15803d;
        }

        [data-theme='dark'] {
            --bg-color: #0f172a;
            --sidebar-bg: #1e293b;
            --sidebar-header-bg: #0f172a;
            --content-header-bg: #1e293b;
            --border-color: #334155;
            --text-main: #f1f5f9;
            --text-muted: #94a3b8;
            --primary: #3b82f6;
            --code-bg: #0f172a;
            --tree-hover: #334155;
            --tree-selected: #0f172a;
            --header-bg: #020617;
            --modal-bg: #1e293b;
            --modal-shadow: rgba(0,0,0,0.5);
            --match-highlight: #854d0e;
            --inlay-bg: #450a0a;
            --inlay-border: #7f1d1d;
            --inlay-text: #fca5a5;
            --score-high-bg: #450a0a;
            --score-high-text: #fca5a5;
            --score-med-bg: #431407;
            --score-med-text: #fed7aa;
            --score-low-bg: #064e3b;
            --score-low-text: #6ee7b7;
        }

        * { box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; margin: 0; height: 100vh; display: flex; flex-direction: column; color: var(--text-main); background: var(--bg-color); overflow: hidden; }
        #app{display:flex;flex-direction:column;height:100%;width:100%}
        header { height: 60px; background: var(--header-bg); color: var(--header-text); display: flex; align-items: center; padding: 0 20px; justify-content: space-between; flex-shrink: 0; border-bottom: 1px solid var(--border-color); }
        .main-container{flex:1;display:flex;overflow:hidden}
        .sidebar{width:350px;background:var(--sidebar-bg);border-right:1px solid var(--border-color);display:flex;flex-direction:column;overflow:hidden;position:relative;flex-shrink:0;transition:width .3s cubic-bezier(.4,0,.2,1)}
        .sidebar.is-resizing{transition:none}
        .sidebar.collapsed{width:0!important;border-right:none}
        .resize-handle{position:absolute;right:0;top:0;bottom:0;width:4px;cursor:col-resize;transition:background .2s;z-index:100}
        .resize-handle:hover,.sidebar.is-resizing .resize-handle{background:var(--primary)}
        .content{flex:1;display:flex;flex-direction:column;background:var(--code-bg);overflow:hidden;position:relative}
        .sidebar-header { padding: 10px 16px 10px 12px; border-bottom: 1px solid var(--border-color); background: var(--sidebar-header-bg); display: flex; align-items: center; gap: 8px; width: 100%; flex-shrink: 0; }
        .sidebar.collapsed .sidebar-header{display:none}
        .header-btn{padding:6px;border-radius:4px;cursor:pointer;color:var(--text-muted);display:flex;align-items:center;justify-content:center;border:1px solid transparent;background:transparent;transition:all .2s;flex-shrink:0}
        .header-btn:hover { background: var(--tree-hover); color: var(--primary); border-color: var(--border-color); }
        .header-btn svg{width:18px;height:18px;fill:currentColor;display:block}
        .header-btn.flip svg{transform:scaleX(-1)}
        .search-box-container{flex:1;position:relative;display:flex;align-items:center}
        .search-box{flex:1;padding:8px 30px 8px 12px;border:1px solid var(--border-color);border-radius:6px;font-size:.85rem;outline:none;width:100%;background:transparent;color:var(--text-main)}
        .search-box:focus{border-color:var(--primary);box-shadow:0 0 0 2px rgba(37,99,235,.1)}
        .clear-btn{position:absolute;right:8px;padding:4px;cursor:pointer;color:var(--text-muted);display:flex;align-items:center;justify-content:center;background:transparent;border:none;border-radius:50%;transition:all .2s}
        .clear-btn:hover { background: var(--tree-hover); color: var(--primary); }
        .clear-btn svg{width:14px;height:14px;fill:currentColor}
        .tree-container{flex:1;overflow:auto;padding:8px 0}
        .sidebar.collapsed .tree-container{display:none}
        .tree-item{display:flex;align-items:center;padding:4px 12px;padding-right:24px;cursor:pointer;font-size:.85rem;white-space:nowrap;user-select:none;min-width:100%;width:max-content}
        .tree-item:hover{background:var(--tree-hover)}
        .tree-item.active{background:var(--tree-selected);color:var(--primary);font-weight:500}
        .tree-expander{width:16px;height:16px;display:flex;align-items:center;justify-content:center;margin-right:4px;color:var(--text-muted);font-size:.7rem;transition:transform .1s;flex-shrink:0}
        .tree-expander.expanded{transform:rotate(90deg)}
        .invisible{visibility:hidden;flex-shrink:0}
        .score-badge{margin-left:auto;font-size:.75rem;font-weight:600;padding:1px 6px;border-radius:10px;flex-shrink:0}
        .score-high { background: var(--score-high-bg); color: var(--score-high-text); }
        .score-med { background: var(--score-med-bg); color: var(--score-med-text); }
        .score-low { background: var(--score-low-bg); color: var(--score-low-text); }
        .content-header { padding: 12px 20px; border-bottom: 1px solid var(--border-color); background: var(--content-header-bg); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .code-container{flex:1;overflow:auto;position:relative;background:var(--code-bg)}
        .code-wrapper{position:relative;padding:20px 0;min-width:max-content}
        .code-line{display:flex;align-items:center;height:20px;line-height:20px;font-family:monospace;font-size:13px}
        .code-line:hover{background:rgba(241,245,249,.5)}
        .line-number{width:50px;text-align:right;padding-right:20px;color:var(--text-muted);font-size:12px;user-select:none;flex-shrink:0;border-right:1px solid var(--border-color);margin-right:15px}
        .line-content{white-space:pre;color:var(--text-main)}

        /* Inlay Hint Styles */
        .inlay-hint {
            display: inline-flex;
            align-items: center;
            background: var(--inlay-bg);
            border: 1px solid var(--inlay-border);
            color: var(--inlay-text);
            padding: 0 6px;
            border-radius: 4px;
            font-size: 11px;
            margin-left: 12px;
            cursor: help;
            white-space: nowrap;
            height: 18px;
            vertical-align: middle;
            font-weight: 500;
            user-select: none;
        }

        .inlay-hint:hover {
            filter: brightness(0.9);
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
            background: var(--modal-bg);
            width: 600px;
            max-width: 90%;
            max-height: 80vh;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 25px -5px var(--modal-shadow);
            border: 1px solid var(--border-color);
        }
        .modal-input-container {
            position: relative;
            display: flex;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
        }
        .modal-input {
            padding: 16px 45px 16px 16px;
            font-size: 16px;
            border: none;
            outline: none;
            flex: 1;
            background: transparent;
            color: var(--text-main);
        }
        .modal-input-container .clear-btn {
            right: 16px;
        }
        .modal-input-container .clear-btn svg {
            width: 20px;
            height: 20px;
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
            border-bottom: 1px solid var(--border-color);
        }
        .result-item.selected { background: var(--tree-selected); }
        .result-info { flex: 1; overflow: hidden; }
        .result-name { font-weight: 500; font-size: 14px; }
        .result-path { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }
        .match-highlight {
            background: var(--match-highlight);
            color: var(--text-main);
            border-radius: 2px;
            font-weight: bold;
        }

        /* Dark Mode Prism Overrides */
        [data-theme='dark'] .token.comment,
        [data-theme='dark'] .token.prolog,
        [data-theme='dark'] .token.doctype,
        [data-theme='dark'] .token.cdata { color: #94a3b8; }
        [data-theme='dark'] .token.punctuation { color: #f1f5f9; }
        [data-theme='dark'] .token.namespace { opacity: .7; }
        [data-theme='dark'] .token.property,
        [data-theme='dark'] .token.tag,
        [data-theme='dark'] .token.boolean,
        [data-theme='dark'] .token.number,
        [data-theme='dark'] .token.constant,
        [data-theme='dark'] .token.symbol,
        [data-theme='dark'] .token.deleted { color: #f472b6; }
        [data-theme='dark'] .token.selector,
        [data-theme='dark'] .token.attr-name,
        [data-theme='dark'] .token.string,
        [data-theme='dark'] .token.char,
        [data-theme='dark'] .token.builtin,
        [data-theme='dark'] .token.inserted { color: #34d399; }
        [data-theme='dark'] .token.operator,
        [data-theme='dark'] .token.entity,
        [data-theme='dark'] .token.url,
        [language-css] .token.string,
        .style .token.string { color: #f1f5f9; }
        [data-theme='dark'] .token.atrule,
        [data-theme='dark'] .token.attr-value,
        [data-theme='dark'] .token.keyword { color: #3b82f6; }
        [data-theme='dark'] .token.function,
        [data-theme='dark'] .token.class-name { color: #fbbf24; }
        [data-theme='dark'] .token.regex,
        [data-theme='dark'] .token.important,
        [data-theme='dark'] .token.variable { color: #e879f9; }

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
            <div style="display: flex; gap: 16px; align-items: center; font-size: 0.9rem;">
                <div>Files: <span style="color: #38bdf8; font-weight: bold;">{{ stats.fileCount }}</span></div>
                <div>Total: <span style="color: #38bdf8; font-weight: bold;">{{ stats.totalScore }}</span></div>
                <div style="color: #94a3b8; font-size: 0.75rem; margin-right: 10px;">{{ stats.date }}</div>
                <button class="header-btn" @click="toggleTheme" :title="'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode'" style="color: white; border: 1px solid rgba(255,255,255,0.2);">
                    <span v-if="theme === 'light'" v-html="MOON_SVG"></span>
                    <span v-else v-html="SUN_SVG"></span>
                </button>
            </div>
        </header>

        <div class="main-container">
            <div 
                class="sidebar" 
                :class="{ collapsed: isSidebarCollapsed, 'is-resizing': isResizing }"
                :style="{ width: isSidebarCollapsed ? '0px' : sidebarWidth + 'px' }"
            >
                <div class="sidebar-header">
                    <div class="search-box-container">
                        <input v-model="filterQuery" class="search-box" placeholder="Filter tree..." />
                        <button v-if="filterQuery" class="clear-btn" title="Clear search" @click="filterQuery = ''">
                            <span v-html="CLEAR_SVG"></span>
                        </button>
                    </div>
                    <button class="header-btn" title="Collapse Sidebar" @click="isSidebarCollapsed = true">
                        <span v-html="SIDEBAR_SVG"></span>
                    </button>
                </div>
                <div class="tree-container">
                    <tree-node
                        v-for="child in filteredTree"
                        :key="child.id"
                        :node="child"
                        :depth="0"
                        :version="treeVersion"
                        :active-id="activeNodeId"
                        :query="filterQuery"
                        @select="selectNode"
                    ></tree-node>
                </div>
                <div class="resize-handle" @mousedown.prevent="startResizing"></div>
            </div>

            <div class="content">
                <div class="content-header">
                    <button v-if="isSidebarCollapsed" class="header-btn flip" style="margin-right: 12px;" @click="isSidebarCollapsed = false" title="Expand Sidebar">
                        <span v-html="SIDEBAR_SVG"></span>
                    </button>
                    <div style="font-family: monospace; color: var(--text-muted); flex: 1; overflow: hidden; text-overflow: ellipsis;">{{ currentFilePath || 'Select a file' }}</div>
                    <div v-if="currentFilePath" :class="['score-badge', getScoreClass(currentFileScore)]">
                        {{ currentFileScore }} Total Complexity
                    </div>
                </div>
                <div class="code-container" ref="codeContainer">
                    <div v-if="!currentFileContent" style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
                        <div style="text-align: center;">
                            <p>Select a method to view code</p>
                        </div>
                    </div>
                    <div v-else class="code-wrapper">
                        <div v-for="(line, i) in highlightedLines" :key="i" class="code-line">
                            <span class="line-number">{{ i + 1 }}</span>
                            <span class="line-content" v-html="line || '&nbsp;'"></span>
                            <span v-if="annotationsByLine[i]" 
                                  class="inlay-hint" 
                                  :title="annotationsByLine[i].message">
                                {{ annotationsByLine[i].shortMsg }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Search Modal -->
        <div v-if="showSearch" class="modal-overlay" @click="closeSearch">
            <div class="modal" @click.stop>
                <div class="modal-input-container">
                    <input ref="searchInput" v-model="searchQuery" class="modal-input" placeholder="Search files and methods..." @keydown.down.prevent="moveSelection(1)" @keydown.up.prevent="moveSelection(-1)" @keydown.enter="selectSearchResult" @keydown.esc="closeSearch">
                    <button v-if="searchQuery" class="clear-btn" title="Clear search" @click="searchQuery = ''; $refs.searchInput.focus()">
                        <span v-html="CLEAR_SVG"></span>
                    </button>
                </div>
                <div class="modal-results">
                    <div v-for="(res, idx) in searchResults"
                         :key="idx"
                         class="result-item"
                         :class="{ selected: idx === selectedResultIndex }"
                         @click="selectResult(res)"
                         @mouseenter="selectedResultIndex = idx">
                        <span style="margin-right: 10px; font-size: 1.2rem;">{{ res.type === 'file' ? '📄' : 'ƒ' }}</span>
                        <div class="result-info">
                            <div class="result-name" v-html="highlightMatch(res.name, searchQuery)"></div>
                            <div class="result-path" v-html="highlightMatch(res.path, searchQuery)"></div>
                        </div>
                        <span :class="['score-badge', getScoreClass(res.score)]">{{ res.score }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
    <script src="https://unpkg.com/fflate"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-csharp.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-jsx.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-tsx.min.js"></script>

    <script>
        const { createApp, ref, computed, onMounted, nextTick, shallowRef, triggerRef, watch } = Vue;

        // Decompress Data from Server
        function decompress(base64) {
            const bin = atob(base64);
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            return JSON.parse(fflate.strFromU8(fflate.unzlibSync(u8)));
        }

        const projectFiles = decompress("${projectFilesBase64}");
        const initialTree = decompress("${treeBase64}");
        const generatedDate = "${date}";

        const SIDEBAR_SVG = \`<svg viewBox="0 0 512 512"><path d="M28.44 85.33h28.44c.03-15.7 12.75-28.42 28.44-28.44h341.33c15.7.03 28.42 12.75 28.44 28.44v341.33c-.03 15.7-12.75 28.42-28.44 28.44H85.33c-15.7-.03-28.42-12.75-28.44-28.44V85.33H28.44H0v341.33c.02 47.14 38.19 85.31 85.33 85.33h341.33c47.14-.02 85.31-38.19 85.33-85.33V85.33C511.98 38.19 473.81.02 426.67 0H85.33C38.19.02.02 38.19 0 85.33H28.44z"/><path d="M142.22 28.44v455.11c0 15.71 12.74 28.44 28.44 28.44s28.44-12.74 28.44-28.44V28.44C199.11 12.73 186.38 0 170.67 0s-28.45 12.73-28.45 28.44"/><path d="M321.22 179l-56.89 56.89c-11.11 11.11-11.11 29.12 0 40.23L321.22 333c11.11 11.11 29.12 11.11 40.23 0s11.11-29.12 0-40.23L324.67 256l36.78-36.78c11.11-11.11 11.11-29.12 0-40.23-11.11-11.11-29.12-11.11-40.23 0z"/></svg>\`;
        const CLEAR_SVG = \`<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>\`;
        const SUN_SVG = \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>\`;
        const MOON_SVG = \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>\`;

        function highlightMatch(text, query) {
            if (!query) return text;
            const q = query.toLowerCase();
            const lowerText = text.toLowerCase();
            let result = '';
            let lastIdx = 0;
            let queryIdx = 0;

            for (let i = 0; i < text.length && queryIdx < q.length; i++) {
                if (lowerText[i] === q[queryIdx]) {
                    result += text.substring(lastIdx, i) + '<span class="match-highlight">' + text[i] + '</span>';
                    lastIdx = i + 1;
                    queryIdx++;
                }
            }
            result += text.substring(lastIdx);
            return queryIdx === q.length ? result : text;
        }

        function fuzzyMatch(text, query) {
            if (!query) return true;
            const q = query.toLowerCase();
            const t = text.toLowerCase();
            let queryIdx = 0;
            for (let i = 0; i < t.length && queryIdx < q.length; i++) {
                if (t[i] === q[queryIdx]) queryIdx++;
            }
            return queryIdx === q.length;
        }

    // --- Components ---

    const TreeNode = {
        name: 'TreeNode',
        props: ['node', 'depth', 'forceExpand', 'activeId', 'version', 'query'],
        template: \`
                <div class="tree-node-wrapper">
                    <div class="tree-item" :class="{ active: isActive }" :style="{ paddingLeft: (depth * 16 + 12) + 'px' }" @click="handleClick">
                        <span
                            class="tree-expander"
                            :class="{ expanded: isExpanded, invisible: !hasChildren }"
                            @click.stop="toggleExpand"
                        >▶</span>
                        <span style="margin-right: 8px; flex-shrink: 0;">{{ icon }}</span>
                        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;" v-html="highlightMatch(node.name, query)"></span>
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
                            :query="query"
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
                    return props.node.type === 'folder' && props.node.children && props.node.children.length > 0;
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
                    toggleExpand();
                    if (props.node.type === 'file') {
                        emit('select', { node: props.node, type: 'file' });
                    }
                }

                return { isExpanded, hasChildren, icon, scoreClass, sortedChildren, sortedMethods, toggleExpand, handleClick, isActive, highlightMatch };
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
                const isSidebarCollapsed = ref(false);
                const sidebarWidth = ref(350);
                const isResizing = ref(false);

                const theme = ref(localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

                function toggleTheme() {
                    theme.value = theme.value === 'light' ? 'dark' : 'light';
                }

                watch(theme, (newTheme) => {
                    document.documentElement.setAttribute('data-theme', newTheme);
                    localStorage.setItem('theme', newTheme);
                }, { immediate: true });

                function startResizing(e) {
                    isResizing.value = true;
                    document.addEventListener('mousemove', handleResizing);
                    document.addEventListener('mouseup', stopResizing);
                    document.body.style.cursor = 'col-resize';
                }

                function handleResizing(e) {
                    if (!isResizing.value) return;
                    const newWidth = e.clientX;
                    if (newWidth > 200 && newWidth < 800) {
                        sidebarWidth.value = newWidth;
                    }
                }

                function stopResizing() {
                    isResizing.value = false;
                    document.removeEventListener('mousemove', handleResizing);
                    document.removeEventListener('mouseup', stopResizing);
                    document.body.style.cursor = '';
                }

                const currentFilePath = ref('');
                const currentFileContent = ref('');
                const currentLanguage = ref('typescript');
                const selectedMethod = ref(null);
                const currentAnnotations = ref([]);

                const currentFileScore = computed(() => {
                    const file = projectFiles.find(f => f.path === currentFilePath.value);
                    return file ? file.totalScore : 0;
                });

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
                         const pathMatch = fuzzyMatch(f.path, q);
                         if (pathMatch) {
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
                             if (fuzzyMatch(m.name, q)) {
                                 results.push({
                                     name: m.name,
                                     path: f.path,
                                     score: m.score,
                                     type: 'method',
                                     methodData: m
                                 });
                             }
                         });
                    });

                    // Sort: Files first, then by score desc
                    return results.sort((a, b) => {
                        if (a.type !== b.type) return a.type === 'file' ? -1 : 1;
                        return b.score - a.score;
                    }).slice(0, 50);
                });

                const highlightedLines = computed(() => {
                    if (!currentFileContent.value) return [];
                    if (window.Prism) {
                        try {
                            const grammar = Prism.languages[currentLanguage.value] || Prism.languages.javascript;
                            const html = Prism.highlight(currentFileContent.value, grammar, currentLanguage.value);
                            
                            // Split and fix tokens that span across lines (simple stack-based fix)
                            const lines = html.split('\\n');
                            const fixedLines = [];
                            let openTags = [];

                            for (let line of lines) {
                                let fixedLine = openTags.join('') + line;
                                
                                // Update open tags stack
                                const tagMatches = line.matchAll(/<span class="([^"]+)">|<\\/span>/g);
                                for (const match of tagMatches) {
                                    if (match[0].startsWith('<span')) {
                                        openTags.push(match[0]);
                                    } else {
                                        openTags.pop();
                                    }
                                }

                                // Close all tags at end of line to keep it valid
                                fixedLine += '</span>'.repeat(openTags.length);
                                fixedLines.push(fixedLine);
                            }
                            return fixedLines;
                        } catch (e) {
                            console.error(e);
                            return currentFileContent.value.split('\\n').map(escapeHtml);
                        }
                    }
                    return currentFileContent.value.split('\\n').map(escapeHtml);
                });

                const annotationsByLine = computed(() => {
                    const map = {};
                    currentAnnotations.value.forEach(ann => {
                        const line = ann.line;
                        if (!map[line]) {
                            map[line] = { score: 0, messages: [], line: line, isTotal: !!ann.isTotal };
                        }
                        map[line].score += ann.score;
                        if (ann.message !== 'nesting' && ann.message !== 'total') {
                            map[line].messages.push(ann.message);
                        }
                        if (ann.isTotal) map[line].isTotal = true;
                    });

                    const finalMap = {};
                    Object.keys(map).forEach(line => {
                        const data = map[line];
                        
                        // Clean messages: Remove leading "+1 " or "+2 " if we are already showing sum
                        const processedMsgs = data.messages.map(m => m.replace(/^\\+\\d+\\s+/, '').trim());
                        let msgs = Array.from(new Set(processedMsgs)).filter(Boolean);
                        
                        if (msgs.length === 0 && data.score > 0 && !data.isTotal) {
                            msgs = ['nesting'];
                        }
                        
                        const label = data.isTotal 
                            ? \`Cognitive Complexity: \${data.score}\`
                            : \`+\${data.score} \${msgs.join(', ')}\`;

                        finalMap[line] = {
                            score: data.score,
                            shortMsg: label,
                            message: label,
                            line: data.line,
                            isTotal: data.isTotal
                        };
                    });
                    return finalMap;
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
                        const matches = fuzzyMatch(node.name, query);
                        let children = [];
                        if (node.children) children = filterNodes(node.children, query);
                        let methods = [];
                        if (node.methods) methods = node.methods.filter(m => fuzzyMatch(m.name, query));
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

                    // For the simplified "File-only" view, we show ALL method annotations at once.
                    if (file.methods && file.methods.length > 0) {
                        const allDetails = [];
                        file.methods.forEach(m => {
                            // Add original details
                            allDetails.push(...m.details);
                            
                            // Add a synthetic "total" hint for the method start line
                            // ONLY for non-callbacks as requested
                            if (!m.isCallback) {
                                allDetails.push({
                                    line: m.startLine,
                                    score: m.score,
                                    message: 'total',
                                    isTotal: true
                                });
                            }
                        });
                        currentAnnotations.value = allDetails;
                        selectedMethod.value = file.methods.reduce((max, m) => m.score > (max ? max.score : 0) ? m : max, file.methods[0]);
                    } else {
                        selectedMethod.value = null;
                        currentAnnotations.value = [];
                    }

                    nextTick(() => {
                        const container = document.querySelector('.code-container');
                        if (container) {
                            if (node.scrollLine !== undefined) {
                                container.scrollTop = node.scrollLine * 20;
                            } else {
                                container.scrollTop = 0;
                            }
                        }
                    });
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
                        const fileNode = nodeMap.get(res.path);
                        selectNode({
                            node: {
                                id: fileNode ? fileNode.id : 'unknown',
                                fullPath: res.path,
                                scrollLine: res.methodData.startLine
                            },
                            type: 'file'
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
                    isSidebarCollapsed,
                    sidebarWidth,
                    isResizing,
                    startResizing,
                    SIDEBAR_SVG,
                    CLEAR_SVG,
                    currentFilePath,
                    currentFileScore,
                    currentFileContent,
                    currentLanguage,
                    highlightedLines,
                    annotationsByLine,
                    selectedMethod,
                    currentAnnotations,
                    getScoreClass,
                    selectNode,
                    highlightMatch,
                    openSearch,
                    closeSearch,
                    moveSelection,
                    selectResult,
                    selectSearchResult,
                    activeNodeId,
                    theme,
                    toggleTheme,
                    SUN_SVG,
                    MOON_SVG
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
    children: [],
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
          children: [],
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
      methods: file.methods.filter((m) => !m.isCallback),
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
