#target illustrator

function main() {
    if (app.documents.length === 0) {
        alert("No document is open.");
        return;
    }

    var doc = app.activeDocument;
    var artboards = doc.artboards;

    for (var i = 0; i < artboards.length; i++) {
        var artboard = artboards[i];
        var itemCount = countItemsInArtboard(doc, artboard);
        alert("Artboard \"" + artboard.name + "\" contains " + itemCount + " item(s).");
    }
}

function countItemsInArtboard(doc, artboard) {
    var rect = artboard.artboardRect; // [left, top, right, bottom]
    var left = rect[0];
    var top = rect[1];
    var right = rect[2];
    var bottom = rect[3];

    var count = 0;
    var items = doc.pageItems;

    for (var j = 0; j < items.length; j++) {
        var bounds = items[j].geometricBounds; // [left, top, right, bottom]
        var itemLeft = bounds[0];
        var itemTop = bounds[1];
        var itemRight = bounds[2];
        var itemBottom = bounds[3];

        var overlaps = !(itemLeft > right || itemRight < left || itemTop < bottom || itemBottom > top);
        if (overlaps) {
            count++;
        }
    }

    return count;
}

main();
