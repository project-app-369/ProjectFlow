using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.Plugins;

using Newtonsoft.Json;

namespace NwSimplifyAddin
{
    // Every API member this file uses was checked by reflecting against the
    // installed Autodesk.Navisworks.Api.dll (Navisworks Manage 2025) - all
    // signatures match. It has not been through an actual compiler (none
    // available in the environment that wrote this), so run a real build
    // before trusting it on the production model.
    [Plugin("SimplifyModel", "PRJF", DisplayName = "Simplify ST-CGF Model", ToolTip = "Hide theoretical/rigging items and build deck/line/discipline/tag selection sets from rules.json")]
    [AddInPlugin(AddInLocation.AddIn)]
    public class SimplifyModelPlugin : AddInPlugin
    {
        public override int Execute(params string[] parameters)
        {
            Document doc = Autodesk.Navisworks.Api.Application.ActiveDocument;
            if (doc == null)
            {
                MessageBox.Show("Open the NWD model first, then run this command.", "Simplify ST-CGF Model");
                return 1;
            }

            string addinDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string rulesPath = Path.Combine(addinDir, "rules.json");
            if (!File.Exists(rulesPath))
            {
                MessageBox.Show("rules.json not found next to the plugin DLL:\n" + rulesPath, "Simplify ST-CGF Model");
                return 1;
            }

            RulesFile rules;
            try
            {
                rules = JsonConvert.DeserializeObject<RulesFile>(File.ReadAllText(rulesPath));
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not parse rules.json:\n" + ex.Message, "Simplify ST-CGF Model");
                return 1;
            }

            var log = new StringBuilder();
            log.AppendLine("Simplify ST-CGF Model - run at " + DateTime.Now);

            List<ModelItem> allItems = GetAllItems(doc).ToList();
            log.AppendLine("Total items scanned: " + allItems.Count);

            // --- 1. Removal rules: hide everything matching a removal rule ---
            var toHide = new ModelItemCollection();
            foreach (RemovalRule rule in rules.RemovalRules)
            {
                int matchCount = 0;
                foreach (ModelItem item in allItems)
                {
                    string actual;
                    if (!TryGetPropertyValue(item, rule.Category, rule.Property, out actual))
                        continue;

                    if (rule.Values.Any(v => MatchValue(actual, rule.MatchType, v)))
                    {
                        toHide.Add(item);
                        matchCount++;
                    }
                }
                log.AppendLine(string.Format("Removal rule '{0}': {1} item(s) matched", rule.Name, matchCount));
            }

            if (toHide.Count > 0)
            {
                doc.Models.SetHidden(toHide, true);
            }
            log.AppendLine("Total hidden: " + toHide.Count);

            // --- 2. Group rules: one Selection Set per distinct property value ---
            foreach (GroupRule rule in rules.GroupRules)
            {
                var buckets = new Dictionary<string, ModelItemCollection>(StringComparer.OrdinalIgnoreCase);
                foreach (ModelItem item in allItems)
                {
                    string value;
                    if (!TryGetPropertyValue(item, rule.Category, rule.Property, out value))
                        continue;
                    if (string.IsNullOrWhiteSpace(value))
                        continue;

                    ModelItemCollection bucket;
                    if (!buckets.TryGetValue(value, out bucket))
                    {
                        bucket = new ModelItemCollection();
                        buckets[value] = bucket;
                    }
                    bucket.Add(item);
                }

                FolderItem folder = GetOrCreateFolderPath(doc, rule.FolderPath);
                foreach (var kv in buckets)
                {
                    var set = new SelectionSet(kv.Value)
                    {
                        DisplayName = rule.SetNamePrefix + kv.Key
                    };
                    doc.SelectionSets.AddCopy(folder, set);
                }

                log.AppendLine(string.Format("Group rule on '{0}' ({1} folder): {2} set(s) created",
                    rule.Property, string.Join("/", rule.FolderPath), buckets.Count));
            }

            string logPath = Path.Combine(addinDir, "simplify-run-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".log");
            File.WriteAllText(logPath, log.ToString());

            log.AppendLine();
            log.AppendLine("Next step: use File > Publish as NWD (Model Data tab, 'Remove Hidden Objects')");
            log.AppendLine("to write out the smaller simplified file - hiding alone does not shrink the NWD.");
            MessageBox.Show(log.ToString(), "Simplify ST-CGF Model - done");

            return 0;
        }

        private static IEnumerable<ModelItem> GetAllItems(Document doc)
        {
            foreach (Model model in doc.Models)
            {
                foreach (ModelItem item in model.RootItem.DescendantsAndSelf)
                {
                    yield return item;
                }
            }
        }

        private static bool TryGetPropertyValue(ModelItem item, string categoryName, string propertyName, out string value)
        {
            value = null;
            PropertyCategory category = item.PropertyCategories.FindCategoryByDisplayName(categoryName);
            if (category == null)
                return false;

            DataProperty prop = category.Properties.FindPropertyByDisplayName(propertyName);
            if (prop == null)
                return false;

            value = prop.Value.ToDisplayString();
            return true;
        }

        private static bool MatchValue(string actual, MatchType matchType, string candidate)
        {
            switch (matchType)
            {
                case MatchType.Contains:
                    return actual.IndexOf(candidate, StringComparison.OrdinalIgnoreCase) >= 0;
                case MatchType.StartsWith:
                    return actual.StartsWith(candidate, StringComparison.OrdinalIgnoreCase);
                default:
                    return string.Equals(actual, candidate, StringComparison.OrdinalIgnoreCase);
            }
        }

        // Walks/creates a nested folder path under the Sets root, e.g.
        // ["Mechanical"] -> Sets > Mechanical. AddCopy clones the item it's
        // given, so after creating a folder we have to look it back up from
        // its parent's children to get a live reference to nest further sets
        // or sub-folders into.
        private static FolderItem GetOrCreateFolderPath(Document doc, List<string> path)
        {
            FolderItem current = doc.SelectionSets.RootItem;
            foreach (string segment in path)
            {
                FolderItem existing = current.Children
                    .OfType<FolderItem>()
                    .FirstOrDefault(f => string.Equals(f.DisplayName, segment, StringComparison.OrdinalIgnoreCase));

                if (existing != null)
                {
                    current = existing;
                    continue;
                }

                var newFolder = new FolderItem { DisplayName = segment };
                doc.SelectionSets.AddCopy(current, newFolder);

                current = current.Children
                    .OfType<FolderItem>()
                    .First(f => string.Equals(f.DisplayName, segment, StringComparison.OrdinalIgnoreCase));
            }
            return current;
        }
    }
}
