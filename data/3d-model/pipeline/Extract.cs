// Geometry extraction for the web model (C# 5). Driven by the "extract" batch command:
//   extract <outDir> <jobsFile>
// jobs file, tab separated, one job per line:
//   equip <id> <nodeName> <cellDivisor>   -> <outDir>/<id>.bin  (vertex-clustered triangle mesh, world metres)
//   struct <id> <nodeName> <minDiagonal>  -> <outDir>/<id>.csv  (one oriented box per geometry leaf)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.ComApi;
using Autodesk.Navisworks.Api.Interop.ComApi;

namespace ModelTool
{
    public class TriSink : InwSimplePrimitivesCB
    {
        public double[] M;           // 16 values, row-vector convention (translation in 12..14) unless ColumnMajor
        public bool Translation3;    // translation at 3,7,11 instead
        public Action<double, double, double, double, double, double, double, double, double> OnTri;

        public void Triangle(InwSimpleVertex v1, InwSimpleVertex v2, InwSimpleVertex v3)
        {
            double ax, ay, az, bx, by, bz, cx, cy, cz;
            Xf(v1, out ax, out ay, out az);
            Xf(v2, out bx, out by, out bz);
            Xf(v3, out cx, out cy, out cz);
            OnTri(ax, ay, az, bx, by, bz, cx, cy, cz);
        }
        public void Line(InwSimpleVertex v1, InwSimpleVertex v2) { }
        public void Point(InwSimpleVertex v1) { }
        public void SnapPoint(InwSimpleVertex v1) { }

        void Xf(InwSimpleVertex v, out double x, out double y, out double z)
        {
            Array c = (Array)(object)v.coord;
            double px = Convert.ToDouble(c.GetValue(1)), py = Convert.ToDouble(c.GetValue(2)), pz = Convert.ToDouble(c.GetValue(3));
            if (!Translation3)
            {
                x = px * M[0] + py * M[4] + pz * M[8] + M[12];
                y = px * M[1] + py * M[5] + pz * M[9] + M[13];
                z = px * M[2] + py * M[6] + pz * M[10] + M[14];
            }
            else
            {
                x = px * M[0] + py * M[1] + pz * M[2] + M[3];
                y = px * M[4] + py * M[5] + pz * M[6] + M[7];
                z = px * M[8] + py * M[9] + pz * M[10] + M[11];
            }
        }
    }

    public static class Extractor
    {
        static bool translation3 = false;
        static bool checkedConvention = false;
        static Dictionary<string, ModelItem> byName;

        static void BuildIndex(Document doc)
        {
            if (byName != null) return;
            byName = new Dictionary<string, ModelItem>();
            foreach (Model m in doc.Models)
                foreach (ModelItem it in m.RootItem.DescendantsAndSelf)
                {
                    if (it.DisplayName == null) continue;
                    if (!byName.ContainsKey(it.DisplayName)) byName[it.DisplayName] = it;
                }
        }

        static double[] Matrix(InwOaFragment3 frag)
        {
            InwLTransform3f3 t = (InwLTransform3f3)(object)frag.GetLocalToWorldMatrix();
            Array a = (Array)(object)t.Matrix;
            var m = new double[16];
            for (int i = 0; i < 16; i++) m[i] = Convert.ToDouble(a.GetValue(i + 1));
            return m;
        }

        // Streams every triangle of the leaf (world coordinates) into onTri.
        static int Stream(ModelItem leaf, Action<double, double, double, double, double, double, double, double, double> onTri)
        {
            int n = 0;
            InwOaPath3 path = (InwOaPath3)ComApiBridge.ToInwOaPath(leaf);
            foreach (InwOaFragment3 frag in path.Fragments())
            {
                var sink = new TriSink();
                sink.M = Matrix(frag);
                sink.Translation3 = translation3;
                sink.OnTri = (ax, ay, az, bx, by, bz, cx, cy, cz) => { n++; onTri(ax, ay, az, bx, by, bz, cx, cy, cz); };
                frag.GenerateSimplePrimitives(nwEVertexProperty.eNORMAL, sink);
            }
            return n;
        }

        static void CheckConvention(ModelItem leaf, StringBuilder log)
        {
            if (checkedConvention) return;
            BoundingBox3D bb = leaf.BoundingBox();
            double best = double.MaxValue; bool bestT = false;
            foreach (bool t3 in new[] { false, true })
            {
                translation3 = t3;
                double minx = 1e30, miny = 1e30, minz = 1e30, maxx = -1e30, maxy = -1e30, maxz = -1e30;
                Stream(leaf, (ax, ay, az, bx, by, bz, cx, cy, cz) =>
                {
                    foreach (double[] p in new[] { new[] { ax, ay, az }, new[] { bx, by, bz }, new[] { cx, cy, cz } })
                    {
                        minx = Math.Min(minx, p[0]); miny = Math.Min(miny, p[1]); minz = Math.Min(minz, p[2]);
                        maxx = Math.Max(maxx, p[0]); maxy = Math.Max(maxy, p[1]); maxz = Math.Max(maxz, p[2]);
                    }
                });
                double err = Math.Abs(minx - bb.Min.X) + Math.Abs(miny - bb.Min.Y) + Math.Abs(minz - bb.Min.Z) + Math.Abs(maxx - bb.Max.X) + Math.Abs(maxy - bb.Max.Y) + Math.Abs(maxz - bb.Max.Z);
                log.AppendLine("convention translation3=" + t3 + " err=" + err.ToString("F3") + " bbox=[" + bb.Min.X.ToString("F2") + "," + bb.Min.Y.ToString("F2") + "," + bb.Min.Z.ToString("F2") + "]-[" + bb.Max.X.ToString("F2") + "," + bb.Max.Y.ToString("F2") + "," + bb.Max.Z.ToString("F2") + "] got=[" + minx.ToString("F2") + "," + miny.ToString("F2") + "," + minz.ToString("F2") + "]-[" + maxx.ToString("F2") + "," + maxy.ToString("F2") + "," + maxz.ToString("F2") + "]");
                if (err < best) { best = err; bestT = t3; }
            }
            translation3 = bestT;
            checkedConvention = true;
            log.AppendLine("using translation3=" + bestT + " (err " + best.ToString("F3") + ")");
        }

        public static void Run(string outDir, string jobsFile)
        {
            Document doc = Autodesk.Navisworks.Api.Application.ActiveDocument;
            Directory.CreateDirectory(outDir);
            BuildIndex(doc);
            var log = new StringBuilder();
            foreach (string line in File.ReadAllLines(jobsFile))
            {
                if (line.Trim().Length == 0 || line.StartsWith("#")) continue;
                string[] f = line.Split('\t');
                var sw = Stopwatch.StartNew();
                ModelItem node;
                if (!byName.TryGetValue(f[2], out node)) { log.AppendLine("MISSING " + f[2]); continue; }
                try
                {
                    if (f[0] == "equip") Equip(outDir, f[1], node, double.Parse(f[3], CultureInfo.InvariantCulture), f.Length > 4 ? double.Parse(f[4], CultureInfo.InvariantCulture) : 0, log);
                    else if (f[0] == "struct") Struct(outDir, f[1], node, double.Parse(f[3], CultureInfo.InvariantCulture), log);
                }
                catch (Exception ex) { log.AppendLine("FAILED " + f[1] + " " + ex.Message); }
                log.AppendLine("  " + f[1] + " took " + sw.Elapsed.TotalSeconds.ToString("F1") + "s");
                File.AppendAllText(Path.Combine(outDir, "extract.log"), log.ToString());
                log.Clear();
            }
        }

        // absCell > 0 welds vertices on that grid (metres); otherwise the grid is the item's diagonal / div
        static void Equip(string outDir, string id, ModelItem node, double div, double absCell, StringBuilder log)
        {
            List<ModelItem> leaves = node.DescendantsAndSelf.Where(x => x.HasGeometry).ToList();
            if (leaves.Count == 0) { log.AppendLine("EMPTY " + id); return; }
            CheckConvention(leaves[0], log);
            BoundingBox3D bb = node.BoundingBox();
            double dx = bb.Max.X - bb.Min.X, dy = bb.Max.Y - bb.Min.Y, dz = bb.Max.Z - bb.Min.Z;
            double diag = Math.Sqrt(dx * dx + dy * dy + dz * dz);
            double cell = absCell > 0 ? absCell : Math.Max(0.04, Math.Min(0.6, diag / div));
            double ox = bb.Min.X, oy = bb.Min.Y, oz = bb.Min.Z;

            var cellIndex = new Dictionary<long, int>();
            var sx = new List<double>(); var sy = new List<double>(); var sz = new List<double>(); var cnt = new List<int>();
            var tris = new HashSet<long>();
            var triList = new List<int>();
            long trisIn = 0;

            Func<double, double, double, int> vert = (x, y, z) =>
            {
                long kx = (long)Math.Floor((x - ox) / cell), ky = (long)Math.Floor((y - oy) / cell), kz = (long)Math.Floor((z - oz) / cell);
                long key = (kx & 0xFFFFF) | ((ky & 0xFFFFF) << 20) | ((kz & 0xFFFFF) << 40);
                int idx;
                if (!cellIndex.TryGetValue(key, out idx))
                {
                    idx = sx.Count; cellIndex[key] = idx; sx.Add(0); sy.Add(0); sz.Add(0); cnt.Add(0);
                }
                sx[idx] += x; sy[idx] += y; sz[idx] += z; cnt[idx]++;
                return idx;
            };

            foreach (ModelItem leaf in leaves)
            {
                trisIn += Stream(leaf, (ax, ay, az, bx, by, bz, cx, cy, cz) =>
                {
                    int a = vert(ax, ay, az), b = vert(bx, by, bz), c = vert(cx, cy, cz);
                    if (a == b || b == c || a == c) return;
                    int lo = Math.Min(a, Math.Min(b, c)), hi = Math.Max(a, Math.Max(b, c)), mid = a + b + c - lo - hi;
                    long k = ((long)lo << 42) | ((long)mid << 21) | (long)hi;
                    if (sx.Count < 2097152 && !tris.Add(k)) return; // the 21-bit index packing is exact only below 2M vertices
                    triList.Add(a); triList.Add(b); triList.Add(c);
                });
            }

            using (var bw = new BinaryWriter(File.Create(Path.Combine(outDir, id + ".bin"))))
            {
                bw.Write(sx.Count); bw.Write(triList.Count / 3);
                for (int i = 0; i < sx.Count; i++) { bw.Write((float)(sx[i] / cnt[i])); bw.Write((float)(sy[i] / cnt[i])); bw.Write((float)(sz[i] / cnt[i])); }
                foreach (int t in triList) bw.Write(t);
            }
            log.AppendLine(id + ": leaves=" + leaves.Count + " trisIn=" + trisIn + " cell=" + cell.ToString("F3") + " -> verts=" + sx.Count + " tris=" + triList.Count / 3);
        }

        static void Struct(string outDir, string id, ModelItem node, double minDiag, StringBuilder log)
        {
            var sb = new StringBuilder();
            int leaves = 0, kept = 0, skipped = 0;
            bool first = true;
            foreach (ModelItem leaf in node.DescendantsAndSelf.Where(x => x.HasGeometry))
            {
                leaves++;
                BoundingBox3D bb = leaf.BoundingBox();
                double dx = bb.Max.X - bb.Min.X, dy = bb.Max.Y - bb.Min.Y, dz = bb.Max.Z - bb.Min.Z;
                if (Math.Sqrt(dx * dx + dy * dy + dz * dz) < minDiag) { skipped++; continue; }
                if (first) { CheckConvention(leaf, log); first = false; }
                var vx = new List<double>(); var vy = new List<double>(); var vz = new List<double>();
                Stream(leaf, (ax, ay, az, bx, by, bz, cx, cy, cz) =>
                {
                    vx.Add(ax); vy.Add(ay); vz.Add(az); vx.Add(bx); vy.Add(by); vz.Add(bz); vx.Add(cx); vy.Add(cy); vz.Add(cz);
                });
                if (vx.Count < 3) continue;
                double[] obb = Obb.Fit(vx, vy, vz);
                sb.Append(string.Join(",", obb.Select(v => v.ToString("F3", CultureInfo.InvariantCulture)))).Append('\n');
                kept++;
            }
            File.WriteAllText(Path.Combine(outDir, id + ".csv"), sb.ToString());
            log.AppendLine(id + ": leaves=" + leaves + " kept=" + kept + " skippedSmall=" + skipped);
        }
    }

    // Oriented bounding box by PCA, then a sweep about the dominant axis to tighten the cross-section.
    public static class Obb
    {
        // returns cx,cy,cz, ux,uy,uz, vx,vy,vz, wx,wy,wz, hu,hv,hw
        public static double[] Fit(List<double> X, List<double> Y, List<double> Z)
        {
            int n = X.Count;
            double mx = 0, my = 0, mz = 0;
            for (int i = 0; i < n; i++) { mx += X[i]; my += Y[i]; mz += Z[i]; }
            mx /= n; my /= n; mz /= n;
            double[,] c = new double[3, 3];
            for (int i = 0; i < n; i++)
            {
                double a = X[i] - mx, b = Y[i] - my, d = Z[i] - mz;
                c[0, 0] += a * a; c[0, 1] += a * b; c[0, 2] += a * d; c[1, 1] += b * b; c[1, 2] += b * d; c[2, 2] += d * d;
            }
            c[1, 0] = c[0, 1]; c[2, 0] = c[0, 2]; c[2, 1] = c[1, 2];
            double[,] ev; double[] ew;
            Jacobi(c, out ev, out ew);
            int imax = 0; for (int k = 1; k < 3; k++) if (ew[k] > ew[imax]) imax = k;
            double[] e1 = { ev[0, imax], ev[1, imax], ev[2, imax] };
            int i2 = (imax + 1) % 3;
            double[] e2 = { ev[0, i2], ev[1, i2], ev[2, i2] };
            double[] e3 = Cross(e1, e2);
            double bestArea = double.MaxValue; double[] bu = null, bv = null; double[] bext = null;
            for (int deg = 0; deg < 90; deg += 5)
            {
                double t = deg * Math.PI / 180.0, ct = Math.Cos(t), st = Math.Sin(t);
                double[] u = { e2[0] * ct + e3[0] * st, e2[1] * ct + e3[1] * st, e2[2] * ct + e3[2] * st };
                double[] v = Cross(e1, u);
                double[] ext = Extents(X, Y, Z, e1, u, v);
                double area = (ext[1] - ext[0]) * (ext[3] - ext[2]) * 1.0 + (ext[5] - ext[4]) * 0.0;
                area = (ext[3] - ext[2]) * (ext[5] - ext[4]);
                if (area < bestArea) { bestArea = area; bu = u; bv = v; bext = ext; }
            }
            double cu = (bext[0] + bext[1]) / 2, cv = (bext[2] + bext[3]) / 2, cw = (bext[4] + bext[5]) / 2;
            double ccx = e1[0] * cu + bu[0] * cv + bv[0] * cw, ccy = e1[1] * cu + bu[1] * cv + bv[1] * cw, ccz = e1[2] * cu + bu[2] * cv + bv[2] * cw;
            return new double[] { ccx, ccy, ccz, e1[0], e1[1], e1[2], bu[0], bu[1], bu[2], bv[0], bv[1], bv[2], (bext[1] - bext[0]) / 2, (bext[3] - bext[2]) / 2, (bext[5] - bext[4]) / 2 };
        }

        static double[] Extents(List<double> X, List<double> Y, List<double> Z, double[] a, double[] b, double[] c)
        {
            double[] r = { 1e30, -1e30, 1e30, -1e30, 1e30, -1e30 };
            for (int i = 0; i < X.Count; i++)
            {
                double pa = X[i] * a[0] + Y[i] * a[1] + Z[i] * a[2], pb = X[i] * b[0] + Y[i] * b[1] + Z[i] * b[2], pc = X[i] * c[0] + Y[i] * c[1] + Z[i] * c[2];
                if (pa < r[0]) r[0] = pa; if (pa > r[1]) r[1] = pa;
                if (pb < r[2]) r[2] = pb; if (pb > r[3]) r[3] = pb;
                if (pc < r[4]) r[4] = pc; if (pc > r[5]) r[5] = pc;
            }
            return r;
        }

        static double[] Cross(double[] a, double[] b)
        {
            return new[] { a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0] };
        }

        static void Jacobi(double[,] a0, out double[,] v, out double[] w)
        {
            double[,] a = (double[,])a0.Clone();
            v = new double[3, 3] { { 1, 0, 0 }, { 0, 1, 0 }, { 0, 0, 1 } };
            for (int sweep = 0; sweep < 30; sweep++)
            {
                double off = Math.Abs(a[0, 1]) + Math.Abs(a[0, 2]) + Math.Abs(a[1, 2]);
                if (off < 1e-14) break;
                for (int p = 0; p < 2; p++)
                    for (int q = p + 1; q < 3; q++)
                    {
                        if (Math.Abs(a[p, q]) < 1e-30) continue;
                        double theta = (a[q, q] - a[p, p]) / (2 * a[p, q]);
                        double t = Math.Sign(theta) / (Math.Abs(theta) + Math.Sqrt(theta * theta + 1));
                        if (theta == 0) t = 1;
                        double cs = 1 / Math.Sqrt(t * t + 1), sn = t * cs;
                        for (int k = 0; k < 3; k++)
                        {
                            double akp = a[k, p], akq = a[k, q];
                            a[k, p] = cs * akp - sn * akq; a[k, q] = sn * akp + cs * akq;
                        }
                        for (int k = 0; k < 3; k++)
                        {
                            double apk = a[p, k], aqk = a[q, k];
                            a[p, k] = cs * apk - sn * aqk; a[q, k] = sn * apk + cs * aqk;
                        }
                        for (int k = 0; k < 3; k++)
                        {
                            double vkp = v[k, p], vkq = v[k, q];
                            v[k, p] = cs * vkp - sn * vkq; v[k, q] = sn * vkp + cs * vkq;
                        }
                    }
            }
            w = new[] { a[0, 0], a[1, 1], a[2, 2] };
        }
    }
}
