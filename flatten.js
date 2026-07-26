#target illustrator

function main() {
    if (app.documents.length === 0) {
        alert("No document is open.");
        return;
    }

    // Mimics Ctrl+A.
    app.executeMenuCommand("selectall");

    // Mimics Object > Flatten Transparency.
    app.executeMenuCommand("Flatten Transparency");
}

main();
