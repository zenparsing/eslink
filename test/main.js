module Path from "node:path";

import { Module } from "../src/Module.js";
import { buildTree } from "../src/TreeBuilder.js";
import { link } from "../src/Linker.js";
import { runTests } from "moon-unit.js";

function compile(path) {

    path = Path.join(__dirname, path);
    
    return buildTree(path).then(root => {
    
        link(root);
        
        var module = root.searchScope(Module.stringName(path));
        
        if (!module)
            throw new Error("Invalid module");
        
        return module;
    });
}

function getBindings(map) {

    var out = {};
    
    map.forEach((binding, name) => {
    
        if (name === "|")
            return;
        
        out[name] = {
        
            module: binding.targetModule.getPath().replace(__dirname + "/", ""),
            name: binding.targetName,
            color: binding.color
        };
    });
    
    return out;
}

runTests({

    "Basic Cycle"(test) {

        return compile("basic-cycle/main.js").then(module => {
        
            test
            
            ._("exports").equals(getBindings(module.exports), {
            
                c: { module: '[basic-cycle/main.js]', name: 'c', color: 'GREEN' }
            })
            
            ._("locals").equals(getBindings(module.localBindings), {
            
                a: { module: '[basic-cycle/a.js]', name: 'a', color: 'GREEN' },
                c: { module: '[basic-cycle/main.js]', name: 'c', color: 'GREEN' }
            });
        });
    },
    
    "Export Star"(test) {
    
        return compile("export-star/main.js").then(module => {
        
            test
            
            ._("exports").equals(getBindings(module.exports), {
                a: { module: '[export-star/a.js]', name: 'a', color: 'YELLOW' },
                b: { module: '[export-star/a.js]', name: 'b', color: 'YELLOW' },
                f: { module: '[export-star/a.js]', name: 'f', color: 'YELLOW' },
                C: { module: '[export-star/a.js]', name: 'C', color: 'YELLOW' },
                M: { module: '[export-star/a.js]', name: 'M', color: 'YELLOW' },
                x: { module: '[export-star/b.js]', name: 'x', color: 'YELLOW' }
            })
            
            ._("locals").equals(getBindings(module.localBindings), {});
            
        });
    },
    
    "Export Star Conflict (Without Import)"(test) {
    
        test._("export * succeeds if a conflicting name is not imported.");
        
        return compile("export-star-conflict-1/main.js").then(module => {
        
            test.equals(getBindings(module.exports), {
                x: { module: '[export-star-conflict-1/a.js]', name: 'x', color: 'RED' }
            });
            
        });
    },
    
    "Export Star Conflict (With Import)"(test) {
    
        test._("export * fails if a conflicting name is imported.");
        
        return compile("export-star-conflict-2/main.js").then(module => {
        
            test.assert(false);
            
        }, error => {
        
            test.assert(true);
        });
    },
    
    "Export Star Conflict (With Same Target)"(test) {
    
        test._("export * fails if conflicting names points to the same target.");
        
        return compile("export-star-conflict-3/main.js").then(module => {
        
            test.assert(false);
            
        }, error => {
        
            test.assert(true);
        });
    }

});