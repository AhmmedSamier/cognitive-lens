using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;

namespace CognitiveComplexity
{
    [ContentType("TypeScript")]
    [ContentType("CSharp")]
    [Export(typeof(ILanguageClient))]
    public class CognitiveComplexityLanguageClient : ILanguageClient
    {
        public string Name => "Cognitive Complexity Language Extension";

        public IEnumerable<string> ConfigurationSections => null;

        public object InitializationOptions => null;

        public IEnumerable<string> FilesToWatch => null;

        public event AsyncEventHandler<EventArgs> StartAsync;
        public event AsyncEventHandler<EventArgs> StopAsync;

        public async Task<Connection> ActivateAsync(CancellationToken token)
        {
            await Task.Yield();

            // We assume 'node' is in the PATH or we bundle it.
            // For now, we assume 'node' is available in the user's environment.
            // The server.js should be placed in the 'Resources' directory of the VSIX.

            string assemblyPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string serverPath = Path.Combine(assemblyPath, "Resources", "server.js");

            if (!File.Exists(serverPath))
            {
                // Fallback or error logging
                return null;
            }

            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = "node";
            info.Arguments = $"\"{serverPath}\" --stdio";
            info.RedirectStandardInput = true;
            info.RedirectStandardOutput = true;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;

            Process process = new Process();
            process.StartInfo = info;

            if (process.Start())
            {
                return new Connection(process.StandardOutput.BaseStream, process.StandardInput.BaseStream);
            }

            return null;
        }

        public async Task OnLoadedAsync()
        {
            await StartAsync.InvokeAsync(this, EventArgs.Empty);
        }

        public Task OnServerInitializeFailedAsync(Exception e)
        {
            return Task.CompletedTask;
        }

        public Task OnServerInitializedAsync()
        {
            return Task.CompletedTask;
        }
    }
}
