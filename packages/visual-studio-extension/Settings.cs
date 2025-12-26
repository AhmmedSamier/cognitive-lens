using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Settings;

namespace CognitiveComplexity
{
    [VisualStudioContribution]
    public static class CognitiveComplexitySettings
    {
        [VisualStudioContribution]
        public static SettingCategory Category { get; } = new("cognitiveComplexity", "Cognitive Lens");

        [VisualStudioContribution]
        public static Setting.Integer WarningThreshold { get; } = new("cognitiveComplexity.threshold.warning", "Warning Threshold", Category)
        {
            Description = "Complexity score threshold for showing a warning.",
            DefaultValue = 15,
        };

        [VisualStudioContribution]
        public static Setting.Integer ErrorThreshold { get; } = new("cognitiveComplexity.threshold.error", "Error Threshold", Category)
        {
            Description = "Complexity score threshold for showing an error.",
            DefaultValue = 25,
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowCodeLens { get; } = new("cognitiveComplexity.showCodeLens", "Show CodeLens", Category)
        {
            Description = "Enable or disable CodeLens for cognitive complexity.",
            DefaultValue = true,
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowGutterIcon { get; } = new("cognitiveComplexity.showGutterIcon", "Show Gutter Icon", Category)
        {
            Description = "Enable or disable the gutter icon for cognitive complexity.",
            DefaultValue = false,
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowDiagnostics { get; } = new("cognitiveComplexity.showDiagnostics", "Show Diagnostics", Category)
        {
            Description = "Enable or disable diagnostics (warnings/errors) for cognitive complexity.",
            DefaultValue = true,
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowInlayHintsMethodScore { get; } = new("cognitiveComplexity.showInlayHints.methodScore", "Show Method Score Inlay Hint", Category)
        {
            Description = "Enable or disable the method score inlay hint.",
            DefaultValue = false,
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowInlayHintsDetails { get; } = new("cognitiveComplexity.showInlayHints.details", "Show Detailed Inlay Hints", Category)
        {
            Description = "Enable or disable detailed contribution inlay hints.",
            DefaultValue = true,
        };

        [VisualStudioContribution]
        public static Setting.String TotalScorePrefix { get; } = new("cognitiveComplexity.totalScorePrefix", "Total Score Prefix", Category)
        {
            Description = "The prefix text to display before the total complexity score.",
            DefaultValue = "Cognitive Complexity",
        };
    }
}
