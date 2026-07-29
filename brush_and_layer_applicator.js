// WHAT THIS SCRIPT DOES
//
// Select your artwork, run the script, and it works through your drawing in
// four steps:
//
// 1. RECOLOURS
//    Every selected line drawn in one of the old CAD colours is repainted in
//    the matching production colour. The pairs are listed in the
//    "CAD_colors_transition" table below - the colour on the left is replaced
//    by the colour on the right.
//
// 2. APPLIES BRUSHES
//    Every line then gets the brush that belongs to its colour, at the line
//    thickness set for that brush. The "brushes" table below lists each brush
//    with the colour it belongs to, its thickness, and the layer its lines
//    should end up on. A red line always gets the red brush, no matter how
//    many colours are in the drawing or in what order they were selected.
//
// 3. SORTS INTO LAYERS
//    Only once all the recolouring and brushing is finished, every line is
//    moved onto the layer named in its brush's entry. If a layer with that
//    name already exists it is reused, so you can run the script on one item
//    at a time and everything still lands together on the same layers.
//
// The script looks inside groups and compound paths, so lines nested in them
// are treated just like loose ones. Lines pulled out of a group end up loose
// on their colour's layer. Compound paths stay whole and move as one piece.
//
// Anything whose colour is not listed in the "brushes" table is left completely
// alone - black construction lines included. Clipping masks and guides are
// never touched. Only lines get brushed; fills are only affected by step 1.
//
// When it finishes, the script reports what it did and warns you about any
// colours it found in the drawing but had no brush for.
//
// BEFORE YOU RUN IT
// - The document must be in RGB colour mode (File > Document Color Mode).
// - Every brush named in the table must already exist in the document's
//   Brushes panel. If one is missing the script stops and tells you which,
//   without having changed anything.
// - Destination layers that are locked or hidden are unlocked and made
//   visible so that lines can be moved onto them. They are left that way.
//
// TO CHANGE HOW IT BEHAVES
// Edit the two tables below. Adding a colour means adding a line to both:
// one pair in "CAD_colors_transition", and one brush in "brushes" carrying
// that same new colour.

if (app.documents.length > 0) {
  var doc = app.activeDocument;
  var selection = app.selection;

  if (selection.length === 0) {
    alert("Please select an object first");
  } else {
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
      Fishtail: { width: 0.6, color: "#E31A1C", layer: "Fishtail" },
      "Dashed Line 1.2": {
        width: 0.6,
        color: "#1F78B4",
        layer: "Dashed Line 1.2",
      },
      Herringbone: { width: 0.6, color: "#33A02C", layer: "Herringbone" },
      "Dashed Line 1.1": {
        width: 0.6,
        color: "#FF7F00",
        layer: "Dashed Line 1.1",
      },
      "Smooth ZigZag 1": {
        width: 2,
        color: "#6A3D9A",
        layer: "Smooth ZigZag 1",
      },
      "Dashed Line 1.4": {
        width: 0.6,
        color: "#009688",
        layer: "Dashed Line 1.4",
      },
      "Bracket Brush": { width: 1, color: "#E7298A", layer: "Bracket Brush" },
      "ZigZag 3": { width: 2, color: "#A65628", layer: "ZigZag 3" },
      "Arrow 2": { width: 0.25, color: "#00838F", layer: "Arrow 2" },
      "Novelty 1": { width: 0.75, color: "#7A8F00", layer: "Novelty 1" },
      Ariel: { width: 0.6, color: "#003F88", layer: "Ariel" },
    };

    // Invert the brush table into colour -> brush name, so a colour can look
    // up the brush that belongs to it. Both sides are normalised hex.
    var hexToBrushName = {};
    for (var brushName in brushes) {
      hexToBrushName[normalizeHex(brushes[brushName].color)] = brushName;
    }

    // Hex matching only works while the document stores RGB values. In a CMYK
    // document Illustrator converts on assignment and the values never
    // round-trip, so bail out before anything is modified.
    if (doc.documentColorSpace !== DocumentColorSpace.RGB) {
      throw new Error(
        "Document is not in RGB mode. The CAD colour transition matches on " +
          "RGB hex values, so convert the document (File > Document Color " +
          "Mode > RGB Color) before running this script.",
      );
    }

    // Flatten the selection once, up front. Every step below works from this
    // one list, so nothing depends on the shape of the selection any more.
    var records = collectPathRecords(selection, [], null);

    // STEP 1: recolour.
    var transitioned = applyColorTransition(records, CAD_colors_transition);

    // STEP 2: decide which brush each path needs. Nothing is modified here, so
    // the whole drawing is inspected in its settled, fully recoloured state.
    var jobs = [];
    var unmatched = [];
    var seenUnmatched = {};
    var neededBrushNames = {};

    for (var i = 0; i < records.length; i++) {
      var path = records[i].path;

      // Clipping masks and guides are structural, never artwork
      if (!path.stroked || path.clipping || path.guides) continue;

      var colorKey = colorToHex(path.strokeColor);
      if (!colorKey) continue;

      var name = hexToBrushName[colorKey];
      if (!name) {
        if (!seenUnmatched[colorKey]) {
          seenUnmatched[colorKey] = true;
          unmatched.push(colorKey);
        }
        continue;
      }

      jobs.push({ record: records[i], brushName: name });
      neededBrushNames[name] = true;
    }

    // Resolve every brush up front so a missing brush aborts before the
    // document has been modified.
    var brushByName = {};
    for (var needed in neededBrushNames) {
      brushByName[needed] = findBrush(doc, needed);
    }

    // STEP 3: apply brushes and widths. These only change appearance, never
    // the document structure, so every reference gathered above stays valid.
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      job.record.path.stroked = true;
      brushByName[job.brushName].applyTo(job.record.path);
      job.record.path.strokeWidth = brushes[job.brushName].width;
    }

    // STEP 4: move items onto their layers. This is the only step that changes
    // the structure of the document, which is why it runs last - moving an item
    // between containers reshuffles its neighbours and can invalidate
    // references to items that have not been processed yet.
    //
    // A path inside a compound path cannot be moved on its own without breaking
    // the compound path, so the whole compound path moves once instead.
    var moveUnits = [];
    var moveLayerNames = [];

    for (var i = 0; i < jobs.length; i++) {
      var unit = jobs[i].record.unit;
      if (indexOfItem(moveUnits, unit) !== -1) continue;
      moveUnits.push(unit);
      moveLayerNames.push(brushes[jobs[i].brushName].layer);
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

    var report =
      "Recoloured " +
      transitioned +
      " item(s) via the CAD colour map.\n" +
      "Brushed " +
      jobs.length +
      " line(s) and moved " +
      moveUnits.length +
      " item(s) onto " +
      layerNamesUsed.length +
      " layer(s).";

    if (unmatched.length > 0) {
      report +=
        "\n\nLeft untouched - no brush designated for these colours:\n#" +
        unmatched.join("\n#");
    }

    alert(report);
  }
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

// Replace every stroke/fill colour that matches a key of the transition map
// with the mapped colour. Returns the number of items that changed.
function applyColorTransition(records, transitionMap) {
  var lookup = {};
  for (var hex in transitionMap) {
    lookup[normalizeHex(hex)] = hexToRGBColor(transitionMap[hex]);
  }

  var changed = 0;

  for (var i = 0; i < records.length; i++) {
    var path = records[i].path;
    var itemChanged = false;

    if (path.stroked) {
      var newStroke = lookup[colorToHex(path.strokeColor)];
      if (newStroke) {
        path.strokeColor = newStroke;
        itemChanged = true;
      }
    }

    if (path.filled) {
      var newFill = lookup[colorToHex(path.fillColor)];
      if (newFill) {
        path.fillColor = newFill;
        itemChanged = true;
      }
    }

    if (itemChanged) changed++;
  }

  return changed;
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

function findBrush(doc, name) {
  var brush = null;
  for (var i = 0; i < doc.brushes.length; i++) {
    if (doc.brushes[i].name === name) {
      brush = doc.brushes[i];
      break;
    }
  }
  if (!brush) {
    var err =
      "Brush [" +
      name +
      "] not found in document. Please make sure it exists in your Brushes panel.";
    throw new Error(err);
  }
  return brush;
}
