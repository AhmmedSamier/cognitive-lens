class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

class Selection extends Range {
  constructor(anchor, active) {
    super(anchor, active);
    this.anchor = anchor;
    this.active = active;
  }
}

class ThemeColor {
  constructor(id) {
    this.id = id;
  }
}

class Uri {
  static parse(value) { return new Uri(value); }
  static joinPath(base, ...paths) { return new Uri(base.path + '/' + paths.join('/')); }
  constructor(path) { this.path = path; this.scheme = 'file'; }
  toString() { return this.path; }
}

const DecorationRangeBehavior = {
  OpenOpen: 0,
  ClosedClosed: 1,
  OpenClosed: 2,
  ClosedOpen: 3
};

const window = {
  createTextEditorDecorationType: () => ({ dispose: () => {} }),
  visibleTextEditors: [],
  activeTextEditor: undefined,
  showTextDocument: () => Promise.resolve(),
  setStatusBarMessage: () => ({ dispose: () => {} }),
  registerWebviewViewProvider: () => ({ dispose: () => {} }),
  onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
  onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
};

const workspace = {
  getConfiguration: () => ({
    get: (key, defaultValue) => defaultValue
  }),
  createFileSystemWatcher: () => ({ dispose: () => {} }),
  onDidCloseTextDocument: () => ({ dispose: () => {} }),
  onDidChangeConfiguration: () => ({ dispose: () => {} }),
};

const commands = {
  registerCommand: () => ({ dispose: () => {} }),
};

module.exports = {
  Position,
  Range,
  Selection,
  ThemeColor,
  Uri,
  DecorationRangeBehavior,
  window,
  workspace,
  commands,
  // Enums as objects
  ViewColumn: { One: 1 },
  StatusBarAlignment: { Left: 1, Right: 2 },
};
