// Adobe Photoshop Script (JSX) to assemble the Notoz App Icon PSD
// Run this script inside Photoshop: File -> Scripts -> Browse... -> select this script

#target photoshop

function main() {
    app.preferences.rulerUnits = Units.PIXELS;
    
    var docWidth = 1024;
    var docHeight = 1024;
    var docResolution = 72;
    var docName = "Notoz_App_Icon_Master";
    
    var doc = app.documents.add(docWidth, docHeight, docResolution, docName, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
    
    // Add Photoshop Guides for Adaptive Icon specifications
    // 54dp center = 512px
    doc.guides.add(Direction.VERTICAL, 512);
    doc.guides.add(Direction.HORIZONTAL, 512);
    // 66dp safe zone = radius 313px -> bounds 199px to 825px
    doc.guides.add(Direction.VERTICAL, 199);
    doc.guides.add(Direction.VERTICAL, 825);
    doc.guides.add(Direction.HORIZONTAL, 199);
    doc.guides.add(Direction.HORIZONTAL, 825);
    
    var scriptFolder = new File($.fileName).parent;
    var layersFolder = new Folder(scriptFolder + "/photoshop_layers");
    
    function placeLayer(fileName, layerName) {
        var file = new File(layersFolder + "/" + fileName);
        if (!file.exists) return null;
        
        var tempDoc = app.open(file);
        tempDoc.selection.selectAll();
        tempDoc.selection.copy();
        tempDoc.close(SaveOptions.DONOTSAVECHANGES);
        
        app.activeDocument = doc;
        doc.paste();
        var placedLayer = doc.activeLayer;
        placedLayer.name = layerName;
        return placedLayer;
    }
    
    // 1. Background Group
    var bgGroup = doc.layerSets.add();
    bgGroup.name = "1. Background Layer";
    var bgLayer = placeLayer("Layer_1_Background_Color.png", "Card Background (#1C1C1E)");
    if (bgLayer) bgLayer.move(bgGroup, ElementPlacement.INSIDE);
    
    // 2. Full Color Brand Group
    var colorGroup = doc.layerSets.add();
    colorGroup.name = "2. Full-Color Adaptive Foreground";
    var fgLayer = placeLayer("Layer_2_Foreground_Full_Color.png", "NOTOZ Brand & Lines");
    if (fgLayer) fgLayer.move(colorGroup, ElementPlacement.INSIDE);
    
    // 3. Monochrome Group (Nothing OS & Google Material You)
    var monoGroup = doc.layerSets.add();
    monoGroup.name = "3. Monochrome (Material You & Nothing OS)";
    var monoLayer = placeLayer("Layer_3_Monochrome_NothingOS_White.png", "Monochrome Silhouette (#FFFFFF)");
    if (monoLayer) monoLayer.move(monoGroup, ElementPlacement.INSIDE);
    
    // 4. Guides Group
    var guideGroup = doc.layerSets.add();
    guideGroup.name = "0. Safe Zone & Mask Guides";
    var guideLayer = placeLayer("Layer_0_Safe_Zone_Guides.png", "66dp Safe Zone & 72dp Mask");
    if (guideLayer) guideLayer.move(guideGroup, ElementPlacement.INSIDE);
    
    alert("Notoz Master App Icon PSD assembled successfully!\n\nAll layers organized:\n- Background (#1C1C1E)\n- Full-Color Foreground\n- Monochrome (Nothing OS & Material You)\n- Safe Zone & Mask Guides");
}

main();
