using System.Diagnostics;
using System.IO.Pipelines;
using System.Reflection;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Editor;
using Microsoft.VisualStudio.Extensibility.LanguageServer;
using Microsoft.VisualStudio.RpcContracts.LanguageServerProvider;

namespace CognitiveComplexity
{
#pragma warning disable VSEXTPREVIEW_LSP
    [VisualStudioContribution]
    public class CognitiveComplexityLanguageServerProvider : LanguageServerProvider
    {
        public CognitiveComplexityLanguageServerProvider(ExtensionCore extensionCore, VisualStudioExtensibility extensibility, TraceSource traceSource)
            : base(extensionCore, extensibility)
        {
        }

        [VisualStudioContribution]
        public static DocumentTypeConfiguration TypeScriptDocumentType => new("typescript")
        {
            FileExtensions = new[] { ".ts", ".tsx" },
            BaseDocumentType = LanguageServerBaseDocumentType,
        };

        [VisualStudioContribution]
        public static DocumentTypeConfiguration CSharpDocumentType => new("csharp")
        {
            FileExtensions = new[] { ".cs" },
            BaseDocumentType = LanguageServerBaseDocumentType,
        };

        public override LanguageServerProviderConfiguration LanguageServerProviderConfiguration => new(
            "Cognitive Complexity",
            new[]
            {
                DocumentFilter.FromDocumentType(TypeScriptDocumentType),
                DocumentFilter.FromDocumentType(CSharpDocumentType)
            });

        public override Task<IDuplexPipe?> CreateServerConnectionAsync(CancellationToken cancellationToken)
        {
            string assemblyPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)!;
            string serverPath = Path.Combine(assemblyPath, "Resources", "server.js");

            ProcessStartInfo info = new ProcessStartInfo
            {
                FileName = "node",
                Arguments = $"\"{serverPath}\" --stdio",
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            Process process = new Process { StartInfo = info };

            if (process.Start())
            {
                return Task.FromResult<IDuplexPipe?>(new DuplexPipe(
                    PipeReader.Create(process.StandardOutput.BaseStream),
                    PipeWriter.Create(process.StandardInput.BaseStream)));
            }

            return Task.FromResult<IDuplexPipe?>(null);
        }

        public override Task OnServerInitializationResultAsync(ServerInitializationResult serverInitializationResult, LanguageServerInitializationFailureInfo? initializationFailureInfo, CancellationToken cancellationToken)
        {
            return base.OnServerInitializationResultAsync(serverInitializationResult, initializationFailureInfo, cancellationToken);
        }

        private class DuplexPipe : IDuplexPipe
        {
            public DuplexPipe(PipeReader input, PipeWriter output)
            {
                Input = input;
                Output = output;
            }

            public PipeReader Input { get; }
            public PipeWriter Output { get; }
        }
    }
}
