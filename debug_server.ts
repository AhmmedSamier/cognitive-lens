
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

const connection = createConnection(ProposedFeatures.all);
console.log('Keys on connection:', Object.keys(connection));
console.log('Has onInlayHint:', typeof connection.onInlayHint);
console.log('Has languages.inlayHint:', connection.languages && connection.languages.inlayHint);
