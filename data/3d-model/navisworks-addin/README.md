# ST-CGF model simplify add-in

Navisworks Manage add-in that, for the currently open model:

1. Hides items matching any **removal rule** in `rules.json` (rigging, scaffolding,
   theoretical safety/exclusion zones, etc).
2. Builds one **Selection Set** per distinct value of a property for each
   **group rule** - e.g. one set per deck, per piping line, per discipline,
   per equipment tag - without you having to list the actual values.

It does **not** by itself produce a smaller NWD file. Hiding an item only
sets a visibility flag; the geometry is still in the file. The last step -
**File > Publish As NWD**, Model Data tab, tick **Remove Hidden Objects** -
is what actually strips it out and shrinks the file. Do that by hand after
running the add-in and review the result before overwriting anything.

## Verification status

Every API call this add-in makes (`ModelItem.DescendantsAndSelf`,
`PropertyCategoryCollection.FindCategoryByDisplayName`,
`DataPropertyCollection.FindPropertyByDisplayName`, `DocumentModels.SetHidden`,
`DocumentSelectionSets.AddCopy`, `SelectionSet(ModelItemCollection)`,
`FolderItem`, `Application.ActiveDocument`, the `[Plugin]`/`[AddInPlugin]`
attributes, etc.) was checked by reflecting directly against the installed
`Autodesk.Navisworks.Api.dll` from **Navisworks Manage 2025** - every member
exists with exactly the signature the code uses. What has **not** been done
is an actual compile: there's no C# compiler/MSBuild on the machine this was
written on, so a typo-level error could still exist. Run the build below and
fix anything it flags - it should be close to nothing.

## 1. Edit `rules.json` for your model

Open the model in Navisworks, click a rigging/scaffolding item and a
structural/piping/mechanical item, and check the **Properties** panel for
the real category/property display names (they depend on the source CAD
export - PDMS, SP3D, Revit, etc. all name these differently). Update
`rules.json`'s `category`/`property`/`values` to match. The file ships with
plausible placeholder names - treat them as examples, not facts.

## 2. Build

Requires Navisworks Manage installed (for the API reference) and the
.NET Framework 4.8 targeting pack.

```bash
dotnet build "data/3d-model/navisworks-addin/NwSimplifyAddin.csproj" -c Release
```

The `NavisworksDir` MSBuild property already defaults to
`C:\Program Files\Autodesk\Navisworks Manage 2025`, which is what's on this
machine; pass `-p:NavisworksDir="..."` to override if you're building
elsewhere.

## 3. Install into Navisworks

Copy the build output (`NwSimplifyAddin.dll`, `Newtonsoft.Json.dll`,
`rules.json`) into a new folder under your Navisworks `Plugins` directory,
e.g.:

```
C:\Program Files\Autodesk\Navisworks Manage 2025\Plugins\SimplifyModel.PRJF\
```

The folder name convention (`<PluginId>.<VendorId>`) matches the
`[Plugin("SimplifyModel", "PRJF", ...)]` attribute in `SimplifyModelPlugin.cs`.
If your installed SDK's samples show a different convention, follow those -
plugin discovery details have varied slightly across Navisworks releases.

## 4. Run

Restart Navisworks, open `STP-STT2B-CPY_20261110.nwd`, find **Simplify
ST-CGF Model** on the Add-ins ribbon tab, and run it. It shows a summary
(items hidden, sets created per rule) and writes a timestamped log next to
the DLL.

## 5. Produce the simplified file

Check the Sets panel and hidden items look right, then:

**File > Publish** → NWD → Model Data tab → check **Remove Hidden Objects**
(uncheck anything else you want to strip, e.g. unused object properties) →
publish to a new file, e.g. `STP-STT2B-CPY_20261110_simplified.nwd`, so the
originals are untouched.
