//@target illustrator

// WHAT THIS SCRIPT DOES
//
// Select your artwork, run the script, and it works through your drawing in
// four steps:
//
// 1. CHECKS EVERYTHING FIRST
//    Before touching anything, the script reads the whole selection, works out
//    what every path will need, and confirms that every needed brush really
//    exists in the document's Brushes panel. If anything is missing or the
//    tables below disagree with each other, it stops, tells you exactly what
//    is wrong, and changes NOTHING. It never leaves the drawing half-done.
//
// 2. RECOLOURS
//    Every selected line drawn in one of the old CAD colours is repainted in
//    the matching production colour. The pairs are listed in the
//    "CAD_colors_transition" table below - the colour on the left is replaced
//    by the colour on the right.
//
// 3. APPLIES BRUSHES
//    Every line then gets the brush that belongs to its colour, at the line
//    thickness set for that brush. The "brushes" table below lists each brush
//    with the colour it belongs to, its thickness, and the layer its lines
//    should end up on. A red line always gets the red brush, no matter how
//    many colours are in the drawing or in what order they were selected.
//    A shape that carries its colour as a fill rather than as a line counts
//    too: it is given a line in that same colour, and then brushed.
//    Recolouring and brushing are decided together, as one plan - so anything
//    that gets recoloured is guaranteed to get its brush in the same run.
//
// 4. SORTS INTO LAYERS, NAMED AFTER YOUR SIZES
//    When the script starts it shows a small dialog: pick a sizing range
//    (Letter, USA, UK, EU or Kids), then a starting size and an end size.
//    Every size between the two stays in - USA from "2" to "4" gives 2, 3, 4.
//    That trimmed list becomes the layer names. The brushes actually used by
//    the selection are put in order of their "layer_index", and paired with
//    the chosen sizes in that order: the lowest-numbered brush in use gets
//    the first size, the next one the second size, and so on. So with sizes
//    S, M, L and lines needing brushes 0, 4 and 11, they land on S, M and L.
//    "[Basic]" has the highest number, so black lines always come last.
//    Once all the recolouring and brushing is finished, every line is moved
//    onto its size-named layer. If a layer with that name already exists it
//    is reused. Because the pairing depends on which brushes are in the
//    selection, select ALL the sizes' lines together - running on one size's
//    lines alone would put them on the first size's layer.
//    If the selection uses more brushes than sizes were chosen, the script
//    stops BEFORE changing anything and lists the brushes in use. Pressing
//    Cancel in the dialog also stops the script with nothing changed.
//    The final popup lists which brush went onto which layer.
//
// The script looks inside groups and compound paths, so lines nested in them
// are treated just like loose ones. Lines pulled out of a group end up loose
// on their colour's layer. Compound paths stay whole and move as one piece.
//
// Anything whose colour is not listed in the "brushes" table is left completely
// alone. No colour is special-cased: black is judged by the tables exactly like
// every other colour. Clipping masks and guides are never touched.
//
// THE POPUP AT THE END
// Every run finishes with a popup, and the popup's first line shows the script
// version. If you ever run the script and see no popup, or a popup without a
// version number, or an older version number, YOU ARE RUNNING AN OUTDATED COPY
// of this file - replace it with the current one.
// The popup also lists every colour found in the drawing that had no brush
// designated for it, so a quiet run always explains itself.
//
// BEFORE YOU RUN IT
// - The document must be in RGB colour mode (File > Document Color Mode).
// - Every brush named in the table must exist in the document's Brushes panel.
//   Small differences in capitalisation or stray spaces around the panel name
//   are forgiven; a genuinely absent brush stops the script before it changes
//   anything, and the popup lists every missing brush by name.
//   The one exception is "[Basic]" (or "Basic"): that is the panel's "no brush"
//   entry rather than a real brush, and Illustrator does not expose it to
//   scripting at all. A colour whose brush is "[Basic]" gets its colour, its
//   width and its layer, and is left with a plain unbrushed stroke. Note this
//   cannot strip a brush a line already carries - it only declines to add one.
// - Destination layers that are locked or hidden are unlocked and made
//   visible so that lines can be moved onto them. They are left that way.
//
// TO CHANGE HOW IT BEHAVES
// Edit the two tables below. Adding a colour means adding a line to both:
// one pair in "CAD_colors_transition", and one brush in "brushes" carrying
// that same new colour. The script checks the two tables against each other
// on every run and refuses to start if they disagree.
// A brush's "layer_index" sets its place in the order brushes are paired with
// sizes. Every brush needs a different whole number; only their order matters.
// The size ranges themselves are the five lists below.

var SCRIPT_TITLE = "Brush & Layer Applicator v9 (2026-10-19)";

// available size ranges
var letter = [
  "3XS",
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
];
var usa = ["1", "2", "3", "4", "5"];
var uk = ["2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22", "24"];
var eu = [
  "30",
  "32",
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
  "52",
];
var kids = [
  "0",
  "3m",
  "6m",
  "12m",
  "18m",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];

var sizeRanges = [
  { name: "Letter", sizes: letter },
  { name: "USA", sizes: usa },
  { name: "UK", sizes: uk },
  { name: "EU", sizes: eu },
  { name: "Kids", sizes: kids },
];

// CAD source colour -> production colour, matched on RGB hex.
// Illustrator has no hex colour type; these strings are parsed into
// RGBColor objects below, so the document must be in RGB mode.
var CAD_colors_transition = {
  "#804040": "#E31A1C", // Red
  "#ff8040": "#1F78B4", // Blue
  "#00ff00": "#33A02C", // Green
  "#008080": "#FF7F00", // Orange
  "#004080": "#6A3D9A", // Purple
  "#8080ff": "#009688", // Teal
  "#800040": "#E7298A", // Magenta
  "#ff0080": "#A65628", // Brown
  "#800000": "#00838F", // Dark Cyan
  "#ff8000": "#7A8F00", // Olive
  "#008000": "#003F88", // Navy
};

var brushes = {
  Fishtail: { width: 0.6, color: "#E31A1C", layer_index: 0 },
  "Dashed Line 1.2": {
    width: 0.6,
    color: "#1F78B4",
    layer_index: 1,
  },
  Herringbone: { width: 0.6, color: "#33A02C", layer_index: 2 },
  "Dashed Line 1.1": {
    width: 0.6,
    color: "#FF7F00",
    layer_index: 3,
  },
  "Smooth ZigZag 1": {
    width: 2,
    color: "#6A3D9A",
    layer_index: 4,
  },
  "Dashed Line 1.4": {
    width: 0.6,
    color: "#009688",
    layer_index: 5,
  },
  "Bracket Brush": { width: 1, color: "#E7298A", layer_index: 6 },
  "ZigZag 3": { width: 1, color: "#A65628", layer_index: 7 },
  "Arrow 2": { width: 0.25, color: "#00838F", layer_index: 8 },
  "Novelty 1": { width: 0.75, color: "#7A8F00", layer_index: 9 },
  Ariel: { width: 0.6, color: "#003F88", layer_index: 10 },
  "[Basic]": { width: 0.6, color: "#000000", layer_index: 11 },
};

// Returns { hexToBrushName, transition, chosenSizes }, or undefined if the
// run should stop (the reason has already been shown to the user).
function prep_tables(doc) {
  var configErrors = [];

  // Invert the brush table into colour -> brush name, so a colour can look
  // up the brush that belongs to it. Both sides are normalised hex.
  var hexToBrushName = {};
  for (var brushName in brushes) {
    var brushHex = normalizeHex(brushes[brushName].color);
    if (hexToBrushName[brushHex]) {
      configErrors.push(
        'Brushes "' +
          hexToBrushName[brushHex] +
          '" and "' +
          brushName +
          '" both claim colour #' +
          brushHex +
          ".",
      );
    }
    hexToBrushName[brushHex] = brushName;
  }

  // Brushes are paired with sizes in layer_index order, so every brush needs
  // its own whole-number layer_index or that order would be ambiguous.
  var layerIndexOwner = {};
  for (var brushName in brushes) {
    var layerIndex = brushes[brushName].layer_index;
    if (
      typeof layerIndex !== "number" ||
      layerIndex !== Math.floor(layerIndex)
    ) {
      configErrors.push(
        'Brush "' + brushName + '" has no whole-number layer_index.',
      );
    } else if (layerIndexOwner[layerIndex]) {
      configErrors.push(
        'Brushes "' +
          layerIndexOwner[layerIndex] +
          '" and "' +
          brushName +
          '" both have layer_index ' +
          layerIndex +
          ".",
      );
    } else {
      layerIndexOwner[layerIndex] = brushName;
    }
  }

  // Normalised CAD hex -> normalised production hex. Every production colour
  // must have a brush, otherwise recolouring could outrun brushing
  var transition = {};
  for (var cadHex in CAD_colors_transition) {
    var targetHex = normalizeHex(CAD_colors_transition[cadHex]);
    transition[normalizeHex(cadHex)] = targetHex;
    if (!hexToBrushName[targetHex]) {
      configErrors.push(
        "Transition target #" +
          targetHex +
          " (from #" +
          normalizeHex(cadHex) +
          ") has no brush in the brushes table.",
      );
    }
  }

  if (configErrors.length > 0) {
    alert(
      SCRIPT_TITLE +
        "\n\nThe two tables at the top of the script disagree. Nothing has " +
        "been changed. Fix the table entries and run again:\n\n" +
        configErrors.join("\n"),
    );
    return;
  }

  // Hex matching only works while the document stores RGB values. In a CMYK
  // document Illustrator converts on assignment and the values never
  // round-trip, so stop before anything is modified.
  if (doc.documentColorSpace !== DocumentColorSpace.RGB) {
    alert(
      SCRIPT_TITLE +
        "\n\nDocument is not in RGB mode, so the colour tables cannot match " +
        "anything. Nothing has been changed. Convert the document (File > " +
        "Document Color Mode > RGB Color) and run again.",
    );
    return;
  }

  // Ask the user which sizes the layers should be named after. Cancelling
  // the dialog aborts the whole run with nothing changed.
  var chosenSizes = promptForSizes(sizeRanges);
  if (!chosenSizes) {
    alert(SCRIPT_TITLE + "\n\nCancelled - nothing has been changed.");
    return;
  }

  return {
    hexToBrushName: hexToBrushName,
    transition: transition,
    chosenSizes: chosenSizes,
  };
}

function main() {
  if (app.documents.length === 0) {
    alert(SCRIPT_TITLE + "\n\nOpen a document first.");
    return;
  }
  var doc = app.activeDocument;
  var sel = app.selection;

  if (!sel || sel.length === 0) {
    alert(SCRIPT_TITLE + "\n\nPlease select an object first.");
    return;
  }

  // ------------------------------------------------------------------------
  // PHASE A: CHECK THE TABLES AGAINST EACH OTHER (nothing touched yet)
  // ------------------------------------------------------------------------
  var tables = prep_tables(doc);
  if (!tables) return; // prep_tables already told the user why
  var hexToBrushName = tables.hexToBrushName;
  var transition = tables.transition;
  var chosenSizes = tables.chosenSizes;

  // ------------------------------------------------------------------------
  // PHASE B: PLAN (read-only - the document is still untouched)
  //
  // For every path, work out what its colours WILL be after the transition,
  // and from that which brush it needs. Because this is computed from the
  // tables rather than by mutating the artwork, the whole run can still be
  // abandoned with zero changes if anything turns out to be missing.
  // ------------------------------------------------------------------------

  var records = collectPathRecords(sel, [], null);

  var inspectedRecords = createFormatPlan(records, transition, hexToBrushName);
  var plan = inspectedRecords.plan;
  var unmatched = inspectedRecords.unmatched;
  var neededBrushNames = inspectedRecords.neededBrushNames;
  var skippedStructural = inspectedRecords.skippedStructural;
  var skippedColourless = inspectedRecords.skippedColourless;

  // Resolve every needed brush against the Brushes panel.
  // A missing brush aborts the operation
  var resolved = resolveBrushes(doc, neededBrushNames);
  if (resolved.missing.length > 0) {
    alert(
      SCRIPT_TITLE +
        "\n\nThese brushes are not in this document's Brushes panel:\n\n" +
        resolved.missing.join("\n") +
        "\n\nNothing has been changed. Add the missing brushes to the " +
        "document (or correct their names in the script) and run again.",
    );
    return;
  }

  // Pair the brushes in use with the chosen sizes, in layer_index order.
  // More brushes than sizes means some lines would have no layer to go to.
  var sizeLayers = assignSizeLayers(neededBrushNames, chosenSizes.sizes);
  if (sizeLayers.used.length > chosenSizes.sizes.length) {
    alert(
      SCRIPT_TITLE +
        "\n\nThe selection uses " +
        sizeLayers.used.length +
        " brushes, but only " +
        chosenSizes.sizes.length +
        " size(s) were chosen (" +
        chosenSizes.summary +
        ").\n\nBrushes in use, in layer order:\n" +
        sizeLayers.used.join("\n") +
        "\n\nNothing has been changed. Choose a wider size range, or select " +
        "fewer lines, and run again.",
    );
    return;
  }

  // ------------------------------------------------------------------------
  // PHASE C: EXECUTE THE PLAN
  // Everything needed is now in hand, so the plan runs to completion.
  // ------------------------------------------------------------------------

  // C1: recolour
  var recoloured = { items: 0, strokes: 0, fills: 0 };
  for (var i = 0; i < plan.length; i++) {
    var entry = plan[i];
    var itemChanged = false;
    if (entry.newStrokeHex) {
      entry.record.path.strokeColor = hexToRGBColor(entry.newStrokeHex);
      recoloured.strokes++;
      itemChanged = true;
    }
    if (entry.newFillHex) {
      entry.record.path.fillColor = hexToRGBColor(entry.newFillHex);
      recoloured.fills++;
      itemChanged = true;
    }
    if (itemChanged) recoloured.items++;
  }

  // C2: apply brushes and widths. These only change appearance, never the
  // document structure, so every reference gathered above stays valid.
  var strokedFromFill = 0;
  for (var i = 0; i < plan.length; i++) {
    var entry = plan[i];
    var p = entry.record.path;

    // A brush lives on the stroke, so a shape that claimed its brush through
    // its fill needs that colour put on its stroke first.
    p.stroked = true;
    if (entry.fromFill) {
      p.strokeColor = hexToRGBColor(entry.colorKey);
      strokedFromFill++;
    }

    // A [Basic] line keeps a plain stroke: colour and width only, no brush.
    if (!isBasicBrushName(entry.brushName)) {
      resolved.byName[entry.brushName].applyTo(p);
    }
    p.strokeWidth = brushes[entry.brushName].width;
  }

  // C3: move items onto their layers. This is the only step that changes the
  // structure of the document, which is why it runs last - moving an item
  // between containers reshuffles its neighbours and can invalidate
  // references to items that have not been processed yet.
  //
  // A path inside a compound path cannot be moved on its own without breaking
  // the compound path, so the whole compound path moves once instead.
  var moveUnits = [];
  var moveLayerNames = [];
  var lastUnit = null;

  for (var i = 0; i < plan.length; i++) {
    var unit = plan[i].record.unit;
    if (unit === lastUnit) continue; // fast path: compound siblings are adjacent
    lastUnit = unit;
    if (indexOfItem(moveUnits, unit) !== -1) continue;
    moveUnits.push(unit);
    // The brush's rank among the brushes in use picks the layer NAME.
    // (The count was checked against the sizes before any changes.)
    moveLayerNames.push(sizeLayers.byBrush[plan[i].brushName]);
  }

  // Walk backwards: if a move does disturb the items behind it in a
  // container, those have already been dealt with.
  var layerCache = {};
  for (var i = moveUnits.length - 1; i >= 0; i--) {
    var layerName = moveLayerNames[i];
    if (!layerCache[layerName]) {
      layerCache[layerName] = getOrCreateLayer(doc, layerName);
    }
    moveUnits[i].move(layerCache[layerName], ElementPlacement.PLACEATEND);
  }

  var layerNamesUsed = [];
  for (var used in layerCache) {
    layerNamesUsed.push(used);
  }

  // ------------------------------------------------------------------------
  // REPORT
  // ------------------------------------------------------------------------

  var report =
    SCRIPT_TITLE +
    "\n\nExamined " +
    records.length +
    " path(s).\n" +
    "Recoloured " +
    recoloured.items +
    " item(s) - " +
    recoloured.strokes +
    " stroke(s), " +
    recoloured.fills +
    " fill(s).\n" +
    "Brushed " +
    plan.length +
    " line(s) and moved " +
    moveUnits.length +
    " item(s) onto " +
    layerNamesUsed.length +
    " layer(s).\n" +
    "Layers are named after: " +
    chosenSizes.summary +
    ".";

  if (sizeLayers.used.length > 0) {
    report += "\n\nBrush -> layer:";
    for (var i = 0; i < sizeLayers.used.length; i++) {
      var usedName = sizeLayers.used[i];
      report += "\n" + usedName + " -> " + sizeLayers.byBrush[usedName];
    }
  }

  if (strokedFromFill > 0) {
    report +=
      "\n\n" +
      strokedFromFill +
      " shape(s) took their brush colour from their fill and were given a " +
      "matching stroke.";
  }

  if (unmatched.length > 0) {
    report +=
      "\n\nLeft untouched - no brush designated for these colours:\n#" +
      unmatched.join("\n#");
  }

  if (skippedStructural > 0 || skippedColourless > 0) {
    report +=
      "\n\nSkipped " +
      skippedStructural +
      " clipping mask(s)/guide(s) and " +
      skippedColourless +
      " path(s) with no plain RGB colour on stroke or fill.";
  }

  alert(report);
}

// Ask the user for a sizing range, a starting size and an end size, in one
// dialog. Everything between start and end (inclusive) is kept - USA "2" to
// "4" gives 2, 3, 4. Returns { sizes: [...], summary: "USA, 2 to 4" }, or
// null if the user cancels.
function promptForSizes(ranges) {
  var dlg = new Window("dialog", SCRIPT_TITLE);
  dlg.orientation = "column";
  dlg.alignChildren = "left";

  dlg.add("statictext", undefined, "Sizing range:");
  var rangeNames = [];
  for (var i = 0; i < ranges.length; i++) rangeNames.push(ranges[i].name);
  var ddRange = dlg.add("dropdownlist", undefined, rangeNames);
  ddRange.preferredSize = [220, -1];

  dlg.add("statictext", undefined, "Starting size:");
  var ddStart = dlg.add("dropdownlist", undefined, []);
  ddStart.preferredSize = [220, -1];

  dlg.add("statictext", undefined, "End size:");
  var ddEnd = dlg.add("dropdownlist", undefined, []);
  ddEnd.preferredSize = [220, -1];

  var row = dlg.add("group");
  var okBtn = row.add("button", undefined, "OK", { name: "ok" });
  row.add("button", undefined, "Cancel", { name: "cancel" });

  function refill(dd, items, selIndex) {
    dd.removeAll();
    for (var i = 0; i < items.length; i++) dd.add("item", items[i]);
    dd.selection = selIndex;
  }

  // Picking a range fills start/end with that range's sizes: start defaults
  // to the first size, end to the last (i.e. the whole range).
  ddRange.onChange = function () {
    var sizes = ranges[ddRange.selection.index].sizes;
    refill(ddStart, sizes, 0);
    refill(ddEnd, sizes, sizes.length - 1);
  };
  ddRange.selection = 0;
  ddRange.onChange(); // some ScriptUI versions don't fire on programmatic set

  // Validate on OK rather than juggling dependent dropdowns: a backwards
  // pick just keeps the dialog open with an explanation.
  okBtn.onClick = function () {
    if (ddStart.selection.index > ddEnd.selection.index) {
      alert("The starting size cannot come after the end size.");
      return;
    }
    dlg.close(1);
  };

  if (dlg.show() !== 1) return null;

  var range = ranges[ddRange.selection.index];
  var from = ddStart.selection.index;
  var to = ddEnd.selection.index;
  return {
    sizes: range.sizes.slice(from, to + 1),
    summary: range.name + ", " + range.sizes[from] + " to " + range.sizes[to],
  };
}

// Flatten a selection down to the path items it contains, recording for each
// one the item that should be moved on its behalf ("unit"). That is the path
// itself, unless it lives inside a compound path - a compound path has to move
// in one piece or it falls apart.
function collectPathRecords(items, out, unit) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.typename === "PathItem") {
      out.push({ path: item, unit: unit ? unit : item });
    } else if (item.typename === "CompoundPathItem") {
      collectPathRecords(item.pathItems, out, unit ? unit : item);
    } else if (item.typename === "GroupItem") {
      collectPathRecords(item.pageItems, out, unit);
    }
  }
  return out;
}

// Inspect records found in the document and prepare a plan of action for formatting
function createFormatPlan(records, transition, hexToBrushName) {
  var plan = [];
  var unmatched = [];
  var seenUnmatched = {};
  var neededBrushNames = {};
  var skippedStructural = 0; // clipping masks and guides
  var skippedColourless = 0; // no RGB colour on stroke or fill at all

  for (var i = 0; i < records.length; i++) {
    var path = records[i].path;

    // Clipping masks and guides are structure, never artwork
    if (path.clipping || path.guides) {
      skippedStructural++;
      continue;
    }

    var strokeHex = path.stroked ? colorToHex(path.strokeColor) : null;
    var fillHex = path.filled ? colorToHex(path.fillColor) : null;

    // The colours this path will carry once the transition has run
    var newStrokeHex =
      strokeHex && transition[strokeHex] ? transition[strokeHex] : null;
    var newFillHex =
      fillHex && transition[fillHex] ? transition[fillHex] : null;
    var finalStrokeHex = newStrokeHex ? newStrokeHex : strokeHex;
    var finalFillHex = newFillHex ? newFillHex : fillHex;

    // The brush is claimed by the stroke colour, and failing that by the
    // fill - a shape carrying its CAD colour as a fill counts too.
    var colorKey = null;
    var fromFill = false;
    if (finalStrokeHex && hexToBrushName[finalStrokeHex]) {
      colorKey = finalStrokeHex;
    } else if (finalFillHex && hexToBrushName[finalFillHex]) {
      colorKey = finalFillHex;
      fromFill = true;
    }

    if (!colorKey) {
      // Record why, so a run that brushes nothing says what it saw instead
      // of failing silently. (Transition targets always have a brush - the
      // table check above guarantees it - so nothing recolourable lands here.)
      var seenHex = finalStrokeHex ? finalStrokeHex : finalFillHex;
      if (!seenHex) {
        skippedColourless++;
      } else if (!seenUnmatched[seenHex]) {
        seenUnmatched[seenHex] = true;
        unmatched.push(seenHex);
      }
      continue;
    }

    plan.push({
      record: records[i],
      brushName: hexToBrushName[colorKey],
      colorKey: colorKey,
      fromFill: fromFill,
      newStrokeHex: newStrokeHex,
      newFillHex: newFillHex,
    });
    neededBrushNames[hexToBrushName[colorKey]] = true;
  }

  return {
    plan: plan,
    unmatched: unmatched,
    neededBrushNames: neededBrushNames,
    skippedStructural: skippedStructural,
    skippedColourless: skippedColourless,
  };
}

// Sort the brushes this run needs by layer_index and give the first one the
// first chosen size, the second one the second size, and so on - so with sizes
// S, M, L and brushes with layer_index 0, 4, 11 in use, they get S, M, L.
// Returns { used: [brushName, ...] in layer order, byBrush: {brushName: size} }.
// Brushes beyond the number of sizes get no entry; the caller checks for that.
function assignSizeLayers(neededBrushNames, sizes) {
  var used = [];
  for (var name in neededBrushNames) used.push(name);
  used.sort(function (a, b) {
    return brushes[a].layer_index - brushes[b].layer_index;
  });

  var byBrush = {};
  for (var i = 0; i < used.length && i < sizes.length; i++) {
    byBrush[used[i]] = sizes[i];
  }
  return { used: used, byBrush: byBrush };
}

// Look up every needed brush in the document's Brushes panel. Exact name match
// first; failing that, a forgiving match that ignores capitalisation and
// leading/trailing spaces, so "fishtail " in the panel still finds Fishtail.
// Returns { byName: {tableName: brush}, missing: [tableName, ...] }.
function resolveBrushes(doc, neededNames) {
  var byExact = {};
  var byLoose = {};
  for (var i = 0; i < doc.brushes.length; i++) {
    var b = doc.brushes[i];
    byExact[b.name] = b;
    byLoose[looseName(b.name)] = b;
  }

  var result = { byName: {}, missing: [] };
  for (var name in neededNames) {
    // "[Basic]" is the Brushes panel's "no brush at all" entry. It is drawn in
    // the panel like a brush, but it is not a Brush object and never appears in
    // doc.brushes, so it can neither be found nor applied. Lines that ask for
    // it get their colour and width and no brush - which is what [Basic] means.
    if (isBasicBrushName(name)) continue;
    var brush = byExact[name] ? byExact[name] : byLoose[looseName(name)];
    if (brush) {
      result.byName[name] = brush;
    } else {
      result.missing.push(name);
    }
  }
  return result;
}

// True for the panel's default no-brush entry, written either way round.
function isBasicBrushName(name) {
  var n = looseName(name);
  return n === "basic" || n === "[basic]";
}

function looseName(name) {
  return String(name)
    .toLowerCase()
    .replace(/^\s+|\s+$/g, "");
}

// Return the existing layer of that name, or create it. Reusing by name is what
// lets the script be run repeatedly, on one item at a time, and still collect
// everything onto the same layers.
function getOrCreateLayer(doc, name) {
  for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name === name) {
      var existing = doc.layers[i];
      // A locked or hidden layer refuses incoming items
      existing.locked = false;
      existing.visible = true;
      return existing;
    }
  }
  var layer = doc.layers.add();
  layer.name = name;
  return layer;
}

function indexOfItem(arr, item) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === item) return i;
  }
  return -1;
}

// "#RRGGBB" (any case, "#" optional) -> "rrggbb", for use as a lookup key.
function normalizeHex(hex) {
  var h = String(hex).toLowerCase();
  if (h.charAt(0) === "#") h = h.substring(1);
  return h;
}

function hexToRGBColor(hex) {
  var h = normalizeHex(hex);
  var color = new RGBColor();
  color.red = parseInt(h.substring(0, 2), 16);
  color.green = parseInt(h.substring(2, 4), 16);
  color.blue = parseInt(h.substring(4, 6), 16);
  return color;
}

// RGBColor -> "rrggbb" lookup key. Returns null for any other colour type
// (gray, spot, gradient, pattern, none), which simply never matches.
// Components are rounded because Illustrator often reports them fractionally.
function colorToHex(color) {
  if (!color || color.typename !== "RGBColor") return null;
  return (
    channelToHex(color.red) +
    channelToHex(color.green) +
    channelToHex(color.blue)
  );
}

function channelToHex(value) {
  var n = Math.round(value);
  if (n < 0) n = 0;
  if (n > 255) n = 255;
  var hex = n.toString(16);
  return hex.length < 2 ? "0" + hex : hex;
}

// Run everything, and make sure ANY failure surfaces as a readable popup
// instead of a cryptic dialog or a silent stop.
try {
  main();
} catch (e) {
  var crashMsg = SCRIPT_TITLE + "\n\nThe script stopped unexpectedly:\n" + e;
  if (e && e.line) crashMsg += "\n(line " + e.line + ")";
  crashMsg +=
    "\n\nSome changes may already have been applied. Undo (Ctrl+Z), fix the " +
    "problem above, and run again.";
  alert(crashMsg);
}
