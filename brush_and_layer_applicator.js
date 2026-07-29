// WHAT THIS SCRIPT DOES
//
// Select your artwork, run the script, and it does three things in order:
//
// 1. RECOLOURS
//    Every selected line drawn in one of the old CAD colours is repainted in
//    the matching production colour. The pairs are listed in the
//    "CAD_colors_transition" table below - the colour on the left is replaced
//    by the colour on the right.
//
// 2. APPLIES BRUSHES
//    Every line then gets the brush that belongs to its colour. The "brushes"
//    table below lists each brush together with the colour it belongs to and
//    the line thickness it should be drawn at. A red line always gets the red
//    brush, no matter how many colours are in the drawing or in what order
//    they were selected.
//
// 3. SORTS INTO LAYERS
//    Every colour is moved onto its own new layer, so the finished drawing is
//    separated by colour.
//
// Anything whose colour is not listed in the "brushes" table is left completely
// alone - black construction lines included. Only lines are affected; fills are
// only touched by step 1.
//
// When it finishes, the script reports how many items it recoloured and warns
// you about any colours it found in the drawing but had no brush for.
//
// BEFORE YOU RUN IT
// - The document must be in RGB colour mode (File > Document Color Mode).
// - Every brush named in the table must already exist in the document's
//   Brushes panel. If one is missing the script stops and tells you which,
//   without having changed anything.
//
// TO CHANGE HOW IT BEHAVES
// Edit the two tables below. Adding a colour means adding a line to both:
// one pair in "CAD_colors_transition", and one brush in "brushes" carrying
// that same new colour.

if (app.documents.length > 0) {
  var doc = app.activeDocument;
  // var selection = app.activeDocument.pathItems;
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
      Fishtail: { width: 0.6, color: "#E31A1C" },
      "Dashed Line 1.2": { width: 0.6, color: "#1F78B4" },
      Herringbone: { width: 0.6, color: "#33A02C" },
      "Dashed Line 1.1": { width: 0.6, color: "#FF7F00" },
      "Smooth ZigZag 1": { width: 2, color: "#6A3D9A" },
      "Dashed Line 1.4": { width: 0.6, color: "#009688" },
      "Bracket Brush": { width: 1, color: "#E7298A" },
      "ZigZag 3": { width: 2, color: "#A65628" },
      "Arrow 2": { width: 0.6, color: "#00838F" },
      "Novelty 1": { width: 0.75, color: "#7A8F00" },
      Ariel: { width: 0.6, color: "#003F88" },
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

    // Colour transition pass: remap CAD colours before anything else, so the
    // brush/layer grouping below keys off the final colours.
    var transitioned = applyColorTransition(selection, CAD_colors_transition);

    // First pass: collect the stroke colours actually present in the selection,
    // split into the ones a brush is designated for and the ones without.
    // Colours with no designated brush (black construction lines included) are
    // reported at the end and otherwise left untouched.
    var colors = []; // hex keys that have a brush, in first-seen order
    var unmatched = []; // hex keys with no brush in the table
    var seen = {};

    for (var i = 0; i < selection.length; i++) {
      if (!selection[i].stroked || !selection[i].strokeColor) continue;

      var colorKey = colorToHex(selection[i].strokeColor);
      if (!colorKey || seen[colorKey]) continue;
      seen[colorKey] = true;

      if (hexToBrushName[colorKey]) {
        colors.push(colorKey);
      } else {
        unmatched.push(colorKey);
      }
    }

    // Resolve every brush up front so a missing brush aborts before the
    // document has been modified.
    var colorToBrush = {};
    for (var i = 0; i < colors.length; i++) {
      //alert("mapping " + colors[i] + " to " + hexToBrushName[colors[i]])
      colorToBrush[colors[i]] = findBrush(doc, hexToBrushName[colors[i]]);
    }
    // Create color to layer mapping
    var colorToLayer = {};
    for (var i = 0; i < colors.length; i++) {
      layer = activeDocument.layers.add();
      colorToLayer[colors[i]] = layer;
    }

    // Second pass: apply each colour's designated brush
    for (var j = 0; j < selection.length; j++) {
      var selectedItem = selection[j];

      // Skip if not stroked or no stroke color
      if (!selectedItem.stroked || !selectedItem.strokeColor) continue;

      var colorKey = colorToHex(selectedItem.strokeColor);
      var brush = colorKey ? colorToBrush[colorKey] : null;

      // No brush designated for this colour: leave the item alone
      if (!brush) continue;

      selectedItem.stroked = true;

      brush.applyTo(selectedItem);

      // move path item to a separate layer

      layer = colorToLayer[colorKey];
      selectedItem.move(layer, ElementPlacement.PLACEATEND);

      selectedItem.strokeWidth = brushes[brush.name].width;

      //alert("applying " + brush.name + " to selected item");
    }

    var report =
      "Recoloured " +
      transitioned +
      " item(s) via the CAD colour map.\n" +
      "Brushed " +
      colors.length +
      " colour group(s).";

    if (unmatched.length > 0) {
      report +=
        "\n\nLeft untouched - no brush designated for these colours:\n#" +
        unmatched.join("\n#");
    }

    alert(report);
  }
}

// Replace every stroke/fill colour that matches a key of the transition map
// with the mapped colour. Returns the number of items that changed.
// Recurses into groups and compound paths, since CAD artwork is rarely flat.
function applyColorTransition(items, transitionMap) {
  var lookup = {};
  for (var hex in transitionMap) {
    lookup[normalizeHex(hex)] = hexToRGBColor(transitionMap[hex]);
  }

  var paths = collectPathItems(items, []);
  var changed = 0;

  for (var i = 0; i < paths.length; i++) {
    var path = paths[i];
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

// Flatten a selection (or any collection) down to the path items it contains.
function collectPathItems(items, out) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.typename === "PathItem") {
      out.push(item);
    } else if (item.typename === "CompoundPathItem") {
      collectPathItems(item.pathItems, out);
    } else if (item.typename === "GroupItem") {
      collectPathItems(item.pageItems, out);
    }
  }
  return out;
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

