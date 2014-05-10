var Path = require("path");
var Util = require("util");

import { buildTree } from "../src/TreeBuilder.js";
import { link } from "../src/Linker.js";

var testModule = process.argv[2] ?
    Path.resolve(process.argv[2]) :
    Path.resolve(__dirname, "../src/Linker.js");

buildTree(testModule).then(root => {

    var test = `[${testModule}]`;
    
    link(root);
    listImports(root.searchScope(test));
    listExports(root.searchScope(test));
    console.log("\n");
});

function listExports(module) {

    console.log("\n== Exports ==\n");
    
    module.exports.forEach((binding, name) => {

        console.log(name);
        
        if (binding.resolved)
            console.log("  " + binding.targetName + " in " + binding.targetModule.getPath());
        else
            console.log("  NOT RESOLVED");
    });
}

function listImports(module) {

    console.log("\n== Imports ==\n");
    
    module.localBindings.forEach((binding, name) => {
    
        if (!binding.imported)
            return;
        
        console.log(name);
        
        if (binding.resolved)
            console.log("  " + binding.targetName + " in " + binding.targetModule.getPath());
        else
            console.log("  NOT RESOLVED");
    });
}