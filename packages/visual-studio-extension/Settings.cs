using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Settings;

namespace CognitiveComplexity
{
#pragma warning disable VSEXTPREVIEW_SETTINGS
    [VisualStudioContribution]
    public static class CognitiveComplexitySettings
    {
        [VisualStudioContribution]
        public static SettingCategory Category { get; } = new("cognitiveComplexity", "Cognitive Lens");

        [VisualStudioContribution]
        public static Setting.Integer WarningThreshold { get; } = new("cognitiveComplexityThresholdWarning", "Warning Threshold", Category, 15)
        {
            Description = "Complexity score threshold for showing a warning.",
        };

        [VisualStudioContribution]
        public static Setting.Integer ErrorThreshold { get; } = new("cognitiveComplexityThresholdError", "Error Threshold", Category, 25)
        {
            Description = "Complexity score threshold for showing an error.",
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowCodeLens { get; } = new("cognitiveComplexityShowCodeLens", "Show CodeLens", Category, true)
        {
            Description = "Enable or disable CodeLens for cognitive complexity.",
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowGutterIcon { get; } = new("cognitiveComplexityShowGutterIcon", "Show Gutter Icon", Category, false)
        {
            Description = "Enable or disable the gutter icon for cognitive complexity.",
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowDiagnostics { get; } = new("cognitiveComplexityShowDiagnostics", "Show Diagnostics", Category, true)
        {
            Description = "Enable or disable diagnostics (warnings/errors) for cognitive complexity.",
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowInlayHintsMethodScore { get; } = new("cognitiveComplexityShowInlayHintsMethodScore", "Show Method Score Inlay Hint", Category, false)
        {
            Description = "Enable or disable the method score inlay hint.",
        };

        [VisualStudioContribution]
        public static Setting.Boolean ShowInlayHintsDetails { get; } = new("cognitiveComplexityShowInlayHintsDetails", "Show Detailed Inlay Hints", Category, true)
        {
            Description = "Enable or disable detailed contribution inlay hints.",
        };

        [VisualStudioContribution]
        public static Setting.String TotalScorePrefix { get; } = new("cognitiveComplexityTotalScorePrefix", "Total Score Prefix", Category, "Cognitive Complexity")
        {
            Description = "The prefix text to display before the total complexity score.",
        };
    }
}
