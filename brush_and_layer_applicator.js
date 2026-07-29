// This Script will:
// - apply a unique brush to all selected items (paths).
//      A unique brush will be applied to an unique color
//      If you have more unique colors than available brushes, the script will fail
//      BLACKS are ignored
// - move each brushed colored path to separate layer (grouped by color)

if (app.documents.length > 0) {
  var doc = app.activeDocument;
  // var selection = app.activeDocument.pathItems;
  var selection = app.selection;

  if (selection.length === 0) {
    alert("Please select an object first");
  } else {
    var colors = [];
    var brushes = {
      "Dashed Line 1.2": 0.6,
      Fishtail: 0.6,
      Herringbone: 0.6,
      "Dashed Line 1.4": 0.6,
      "ZigZag 3": 2,
      "Smooth ZigZag 1": 2,
      "Bracket Brush": 1,
      "Dashed Line 1.1": 0.6,
      "Arrow 2": 0.6,
      Ariel: 0.6,
      "Criss Cross 2": 0.6,
      "Novelty 1": 0.75,
    };

    var brushNames = [];
    for (var key in brushes) {
      brushNames.push(key);
    }

    // First pass: collect unique colors (using string representation for comparison)
    for (var i = 0; i < selection.length; i++) {
      if (selection[i].stroked && selection[i].strokeColor) {
        var color = selection[i].strokeColor;
        var colorKey = getColorKey(color); // Convert color to comparable string
        if (
          !contains(colors, colorKey) &&
          // SKIP BLACKS
          colorKey !== "RGB_0_0_0" &&
          colorKey !== "CMYK_0_0_0_100" &&
          colorKey !== "GRAY_100"
        ) {
          colors.push(colorKey);
        }
      }
    }

    if (colors.length > brushNames.length) {
      throw new Error("You have more colors that available brushes");
    }

    // Create color to brush mapping.
    // Resolve every brush up front so a missing brush aborts before the
    // document has been modified.
    var colorToBrush = {};
    for (var i = 0; i < colors.length; i++) {
      //alert("mapping " + colors[i] + " to " + brushNames[i])
      colorToBrush[colors[i]] = findBrush(doc, brushNames[i]);
    }
    // Create color to layer mapping
    var colorToLayer = {};
    for (var i = 0; i < colors.length; i++) {
      layer = activeDocument.layers.add();
      colorToLayer[colors[i]] = layer;
    }

    // Second pass: apply brushes
    for (var j = 0; j < selection.length; j++) {
      var selectedItem = selection[j];

      // Skip if not stroked or no stroke color
      if (!selectedItem.stroked || !selectedItem.strokeColor) continue;

      var colorKey = getColorKey(selectedItem.strokeColor);

      // SKIP BLACKS
      if (
        colorKey !== "RGB_0_0_0" &&
        colorKey !== "CMYK_0_0_0_100" &&
        colorKey !== "GRAY_100"
      ) {
        var brush = colorToBrush[colorKey];

        selectedItem.stroked = true;

        brush.applyTo(selectedItem);

        // move path item to a separate layer

        layer = colorToLayer[colorKey];
        selectedItem.move(layer, ElementPlacement.PLACEATEND);

        selectedItem.strokeWidth = brushes[brush.name];

        //alert("applying " + brushName + " to selected item");
      }
    }
  }
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

// Helper function to create a comparable key from a color object
function getColorKey(color) {
  if (!color) return "none";

  // Handle different color types.
  // Components are always separated by "_" so that different colors cannot
  // produce the same key (e.g. rgb(1,12,3) vs rgb(11,2,3)).
  if (color.typename === "RGBColor") {
    //alert("detected coloUr RGB_" + color.red + "_" + color.green + "_" + color.blue);
    return "RGB_" + color.red + "_" + color.green + "_" + color.blue;
  } else if (color.typename === "CMYKColor") {
    //alert("detected coloUr CMYK_" + color.cyan + "_" + color.magenta + "_" + color.yellow + "_" + color.black);
    return (
      "CMYK_" +
      color.cyan +
      "_" +
      color.magenta +
      "_" +
      color.yellow +
      "_" +
      color.black
    );
  } else if (color.typename === "GrayColor") {
    //alert("detected coloUr GRAY_" + color.gray);
    return "GRAY_" + color.gray;
  } else if (color.typename === "SpotColor") {
    //alert("detected coloUr SPOT_" + color.spot.name + "_" + color.tint);
    return "SPOT_" + color.spot.name + "_" + color.tint;
  } else {
    return "unknown";
  }
}

function contains(arr, value) {
  for (var j = 0; j < arr.length; j++) {
    if (arr[j] === value) return true;
  }
  return false;
}
