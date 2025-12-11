using Microsoft.VisualStudio.Extensibility;

namespace CognitiveComplexity
{
    [VisualStudioContribution]
    public class CognitiveComplexityExtension : Extension
    {
        public override ExtensionConfiguration ExtensionConfiguration => new()
        {
            Metadata = new(
                id: "CognitiveLens.001",
                version: this.ExtensionAssemblyVersion,
                publisherName: "ASamir",
                displayName: "Cognitive lens",
                description: "Shows Cognitive Complexity for TypeScript and C# methods")
        };
    }
}
