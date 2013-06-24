module Path from "node:path";
module Util from "node:util";

import { buildTree } from "../src/TreeBuilder.js";
import { link } from "../src/Linker.js";

buildTree(Path.resolve(__dirname, "../src/Linker.js")).then(root => {

    var test = "[/Users/thumpandhustle/Code/js-link/src/Parser.js]";
    
    link(root);
    listExports(root.searchScope(test));
});

function listExports(module) {

    module.exports.forEach((binding, name) => {
    
        console.log(name);
        
        if (binding.resolved)
            console.log("  " + binding.targetName + " in " + binding.targetModule.getPath());
        else
            console.log("  NOT RESOLVED");
    });
}