using System.Collections.Generic;
using Newtonsoft.Json;

namespace NwSimplifyAddin
{
    // Mirrors rules.json. Keep this in sync if you change the config shape.

    public class RulesFile
    {
        [JsonProperty("removalRules")]
        public List<RemovalRule> RemovalRules { get; set; } = new List<RemovalRule>();

        [JsonProperty("groupRules")]
        public List<GroupRule> GroupRules { get; set; } = new List<GroupRule>();
    }

    public enum MatchType
    {
        Equals,
        Contains,
        StartsWith
    }

    public class RemovalRule
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("category")]
        public string Category { get; set; }

        [JsonProperty("property")]
        public string Property { get; set; }

        [JsonProperty("matchType")]
        public MatchType MatchType { get; set; } = MatchType.Equals;

        [JsonProperty("values")]
        public List<string> Values { get; set; } = new List<string>();
    }

    // Groups every item that has a value for Category/Property into one
    // Selection Set per distinct value - e.g. one set per deck, per line
    // number, per discipline, or per equipment tag - without needing to
    // know the actual values ahead of time.
    public class GroupRule
    {
        [JsonProperty("folderPath")]
        public List<string> FolderPath { get; set; } = new List<string>();

        [JsonProperty("category")]
        public string Category { get; set; }

        [JsonProperty("property")]
        public string Property { get; set; }

        [JsonProperty("setNamePrefix")]
        public string SetNamePrefix { get; set; } = "";
    }
}
