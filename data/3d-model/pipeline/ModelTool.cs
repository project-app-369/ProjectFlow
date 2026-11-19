// Navisworks plugin driven headlessly by run-tool.ps1 (C# 5, built with the in-box csc).
// Commands (first parameter): tree <out.txt> [maxDepth]
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.Plugins;

namespace ModelTool
{
    [Plugin("ModelTool", "PRJF", DisplayName = "Model tool")]
    [AddInPlugin(AddInLocation.None)]
    public class ModelToolPlugin : AddInPlugin
    {
        public override int Execute(params string[] p)
        {
            try
            {
                if (p[0] == "batch")
                {
                    foreach (string line in File.ReadAllLines(p[1]))
                    {
                        if (line.Trim().Length == 0 || line.StartsWith("#")) continue;
                        Run(line.Split('	'));
                    }
                }
                else Run(p);
                return 0;
            }
            catch (Exception ex)
            {
                File.WriteAllText(p.Length > 1 ? p[1] + ".err" : "modeltool.err", ex.ToString());
                return 1;
            }
        }

        public static string Str(VariantData v)
        {
            if (v.IsDisplayString) return v.ToDisplayString();
            if (v.IsIdentifierString) return v.ToIdentifierString();
            if (v.IsNamedConstant) return v.ToNamedConstant().DisplayName;
            if (v.IsAnyDouble) return v.ToAnyDouble().ToString("R");
            if (v.IsInt32) return v.ToInt32().ToString();
            if (v.IsBoolean) return v.ToBoolean().ToString();
            if (v.IsDateTime) return v.ToDateTime().ToString("s");
            if (v.IsNone) return "";
            if (v.IsPoint3D) { Point3D q = v.ToPoint3D(); return q.X + "," + q.Y + "," + q.Z; }
            return v.ToString();
        }

        static void Run(string[] p)
        {
            string cmd = p[0];
            if (cmd == "tree") { Tree(p[1], p.Length > 2 ? int.Parse(p[2]) : 4); }
            else if (cmd == "props") { Props(p[1], p[2]); }
            else if (cmd == "extract") { Extractor.Run(p[1], p[2]); }
            else if (cmd == "children") { Children(p[1], p.Skip(2).ToArray()); }
            else if (cmd == "subtree") { Subtree(p[1], p[2], int.Parse(p[3])); }
            else throw new Exception("unknown command " + cmd);
        }

        // children <out> <zoneName>...: one TSV line per direct child of every item named like a zone
        static void Children(string outPath, string[] zones)
        {
            Document doc = Autodesk.Navisworks.Api.Application.ActiveDocument;
            var sb = new StringBuilder();
            sb.AppendLine("zone	name	class	kids	geo	minx	miny	minz	maxx	maxy	maxz");
            var want = new HashSet<string>(zones);
            foreach (Model m in doc.Models)
                foreach (ModelItem it in m.RootItem.DescendantsAndSelf)
                {
                    if (it.DisplayName == null || !want.Contains(it.DisplayName)) continue;
                    foreach (ModelItem c in it.Children)
                    {
                        BoundingBox3D b = c.BoundingBox();
                        sb.AppendLine(it.DisplayName + "	" + c.DisplayName + "	" + c.ClassDisplayName + "	" + c.Children.Count() + "	" + c.DescendantsAndSelf.Count(x => x.HasGeometry)
                            + "	" + b.Min.X.ToString("F2") + "	" + b.Min.Y.ToString("F2") + "	" + b.Min.Z.ToString("F2") + "	" + b.Max.X.ToString("F2") + "	" + b.Max.Y.ToString("F2") + "	" + b.Max.Z.ToString("F2"));
                    }
                }
            File.WriteAllText(outPath, sb.ToString());
        }

        // subtree <out> <exactName> <depth>: print every item named exactName with its descendants to <depth>
        static void Subtree(string outPath, string name, int depth)
        {
            Document doc = Autodesk.Navisworks.Api.Application.ActiveDocument;
            var sb = new StringBuilder();
            foreach (Model m in doc.Models)
                foreach (ModelItem it in m.RootItem.DescendantsAndSelf)
                    if (it.DisplayName == name) { Walk(it, 0, depth, sb); sb.AppendLine(); }
            File.WriteAllText(outPath, sb.ToString());
        }

        static void Tree(string outPath, int maxDepth)
        {
            Document doc = Autodesk.Navisworks.Api.Application.ActiveDocument;
            var sb = new StringBuilder();
            foreach (Model m in doc.Models)
            {
                sb.AppendLine("MODEL " + m.FileName + " | root=" + m.RootItem.DisplayName + " units=" + m.Units);
                Walk(m.RootItem, 0, maxDepth, sb);
            }
            File.WriteAllText(outPath, sb.ToString());
        }

        static void Walk(ModelItem it, int depth, int maxDepth, StringBuilder sb)
        {
            int kids = it.Children.Count();
            int geo = 0;
            if (depth <= 3) geo = it.DescendantsAndSelf.Count(x => x.HasGeometry);
            sb.AppendLine(new string(' ', depth * 2) + "[" + depth + "] " + it.DisplayName + " <" + it.ClassDisplayName + "> kids=" + kids + (depth <= 3 ? " geoDesc=" + geo : "") + (it.HasGeometry ? " GEO" : ""));
            if (depth >= maxDepth) return;
            int shown = 0;
            foreach (ModelItem c in it.Children)
            {
                if (shown++ >= 80) { sb.AppendLine(new string(' ', depth * 2 + 2) + "... (" + (kids - 80) + " more)"); break; }
                Walk(c, depth + 1, maxDepth, sb);
            }
        }

        // props <out> <displayNamePath>: dump all property categories of the first item whose name path matches
        static void Props(string outPath, string needle)
        {
            Document doc = Autodesk.Navisworks.Api.Application.ActiveDocument;
            var sb = new StringBuilder();
            int n = 0;
            foreach (Model m in doc.Models)
                foreach (ModelItem it in m.RootItem.DescendantsAndSelf)
                {
                                        if (it.DisplayName == null || it.DisplayName != needle) continue;
                    sb.AppendLine("ITEM " + it.DisplayName + " <" + it.ClassDisplayName + ">");
                    foreach (PropertyCategory c in it.PropertyCategories)
                    {
                        sb.AppendLine("  CAT " + c.DisplayName);
                        foreach (DataProperty dp in c.Properties) sb.AppendLine("    " + dp.DisplayName + " = " + Str(dp.Value));
                    }
                    if (++n >= 3) { File.WriteAllText(outPath, sb.ToString()); return; }
                }
            File.WriteAllText(outPath, sb.ToString());
        }
    }
}
