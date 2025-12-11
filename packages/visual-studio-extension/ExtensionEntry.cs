using Microsoft.VisualStudio.Extensibility;

namespace CognitiveComplexity
{
    [VisualStudioContribution]
    public class CognitiveComplexityExtension : Extension
    {
        public override ExtensionConfiguration ExtensionConfiguration => new()
        {
            Metadata = new(
                id: "CognitiveComplexity.Jules.001",
                version: this.ExtensionAssemblyVersion,
                publisherName: "jules",
                displayName: "Cognitive Complexity",
                description: "Shows Cognitive Complexity for TypeScript and C# methods")
        };
    }
}
