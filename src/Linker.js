import { forEachChild as forEachAST } from "Parser.js";
import { Module } from "Module.js";

import {

    Binding,
    BindingMap,
    BindingEdge,
    GRAY,
    BLACK,
    YELLOW,
    GREEN,
    RED

} from "Binding.js";


class StarBinding extends Binding {

    constructor(targetMap) {
    
        super();
        this.targetMap = targetMap;
    }
}

export function link(rootModule) {
    
    var redList = [];
    
    function visitModule(module) {
    
        module.localBindings.forEach(followEdges);
        module.children.forEach(visitModule);
    }
    
    function followEdges(binding) {
    
        if (!binding.resolved)
            return;
        
        var name = binding.name;
        
        binding.map.starEdges.forEach(target => createStarEdge(binding, target, name));
        binding.edges.forEach(edge => followEdge(binding, edge));
    }

    function followEdge(source, edge) {
        
        var dest = edge.binding,
            color = edge.star ? YELLOW : GREEN;
        
        if (dest.resolved)
            return;
        
        if (edge.path.length > 0) {
    
            createEdge(
                dest,
                getModuleExports(source),
                edge.path[0],
                edge.path.slice(1));
        
            return;
        }
        
        dest.resolve(
            source.targetModule,
            source.targetName,
            color);
        
        if (dest instanceof StarBinding) {
            
            createStarEdges(
                getModuleExports(source),
                dest.targetMap);
            
        } else {
    
            followEdges(dest);
        }
    }
    
    function getModuleExports(binding) {
    
        var target = binding.target;
        
        if (!target || target.type !== "module")
            throw new Error("Expected a module!");
        
        return target.module.exports;
    }
    
    function createStarEdges(from, to) {
    
        from.addStarEdge(to);
        
        from.forEach((binding, name) => {
            
            if (!binding.resolved)
                return;
            
            var edge = createStarEdge(binding, to, name);
            
            if (edge)
                followEdge(binding, edge);
        });
    }
    
    function createEdge(binding, exports, name, path) {
        
        var edge = new BindingEdge(binding, path),
            from = exports.add(name);
        
        from.addEdge(edge);
        
        if (from.resolved)
            followEdge(from, edge);
    }
    
    function createStarEdge(binding, target, name) {
    
        var b = target.add(name), 
            edge = null;
        
        switch (b.color) {
        
            case GRAY:
                edge = binding.createEdge(b);
                edge.star = true;
                break;
            
            case YELLOW:
                redList.push(b);
                break;
        }
        
        return edge;
    }
    
    function poisonBinding(binding) {
    
        if (binding.color === RED)
            return;
        
        binding.color = RED;
        binding.edges.forEach(edge => poisonBinding(edge.binding));
        
        if (binding instanceof StarBinding) {
        
            getModuleExports(binding).forEach(source => {
            
                source.edges.forEach(edge => {
                
                    var dest = edge.binding;
                    
                    if (dest.map === binding.targetMap)
                        poisonBinding(dest);
                });
            });
        }
    }
    
    function finalize(module) {
    
        // Remove all gray exports
        module.exports.forEach((binding, name) => {
        
            if (binding.color === GRAY)
                module.exports.delete(name);
        });
        
        // Test for validity
        module.localBindings.forEach(binding => {
        
            if (!binding.resolved || binding.color === RED)
                throw new Error("Unresolved binding.");
        });
        
        module.children.forEach(finalize);
    }
    
    buildGraph(rootModule);
    visitModule(rootModule);
    redList.forEach(poisonBinding);
    finalize(rootModule);
}

function buildGraph(module) {

    var targets = module.bindingTargets,
        locals = module.localBindings,
        exports = module.exports,
        moduleRefs = new BindingMap;
    
    function visit(node, topLevel, exporting) {
    
        var binding, path;
        
        switch (node.type) {
        
            // let x; const x; var x;
            case "VariableDeclaration":
                if (topLevel || node.keyword === "var") getVariables(node, exporting);
                return;
            
            // function F() {}
            case "FunctionDeclaration":
                addTarget(node.ident.value, exporting, { type: "function" });
                return;
            
            // class C {}
            case "ClassDeclaration":
                addTarget(node.ident.value, exporting, { type: "class" });
                return;
            
            // module A {}
            case "ModuleDeclaration":
                addTarget(node.ident.value, exporting, { type: "module", module: lookupModule(node.ident.value) });
                return;
            
            // module A from "foo";
            case "ModuleFromDeclaration":
            
                moduleRefs.add(moduleName(node.from)).createEdge(
                    locals.addNew(node.ident.value),
                    []);

                return;
                
            // module A = B.C;
            case "ModuleAlias":
            
                moduleRefs.add(moduleName(node.path)).createEdge(
                    locals.addNew(node.ident.value), 
                    modulePath(node.path).slice(1));
                    
                return;
            
            case "ExportSpecifierSet":
                
                if (!node.specifiers) {
                    
                    if (!node.from) {
                    
                        // TODO: export *;
                        throw new Error("TODO");
                        
                    } else {
                    
                        // export * from "foo";
                        // export * from A.B;
                        moduleRefs.add(moduleName(node.from)).createEdge(
                            new StarBinding(exports), 
                            modulePath(node.from).slice(1));
                    }
                
                } else {
                
                    // export { a, b, c as d };
                    node.specifiers.forEach(spec => {
                    
                        locals.add(spec.local.value).createEdge(
                            exports.addNew((spec.remote || spec.local).value));
                    });
                }
                
                return;
                
            case "ExportDeclaration":
            
                if (node.binding.type !== "ExportSpecifierSet") {
                
                    // export [declaration];
                    forEachAST(node, child => visit(child, topLevel, true));
                    return;
                }
                
                break;
            
            case "ImportDeclaration":
                
                // import { x as y } from "foo";
                // import { x as y } from A.B;
                binding = moduleRefs.add(moduleName(node.from));
                path = modulePath(node.from);
                
                node.specifiers.forEach(spec => {
                
                    var importPath = path.slice(1);
                    importPath.push(spec.remote.value);
                    
                    binding.createEdge(
                        locals.addNew((spec.local || spec.remote).value), 
                        importPath);
                });
                
                break;
            
            case "Block":
                topLevel = false;
                break;
        
            // TODO: Improve case handling
            case "ClassExpression":
            case "ClassBody":
            case "FunctionExpression":
            case "FormalParameter":
            case "FunctionBody":
                return;
        }
        
        forEachAST(node, child => visit(child, topLevel));
    }
    
    function getVariables(node, exporting) {
    
        if (node.type === "Identifier" && node.context === "declaration")
            addTarget(node.value, exporting, { type: "variable" });
        
        forEachAST(node, c => getVariables(c, exporting));
    }
    
    function addTarget(name, exporting, value) {
    
        targets.set(name, value);
        
        var local = locals.addNew(name).resolve(module, name);
        
        if (exporting)
            local.createEdge(exports.addNew(name));
    }
    
    function moduleName(node) {
    
        switch (node.type) {
        
            case "Identifier":
                return node.value;
            
            case "String":
                return Module.stringName(node.resolvedPath);
            
            case "ModulePath":
                return modulePath(node).slice(0, 1).join("");
            
            default:
                throw new Error("Invalid node " + node.type);
        }
    }
    
    function modulePath(node) {
    
        if (node.type === "ModulePath")
            return node.elements.map(e => e.value);
        
        return [Module.stringName(node.resolvedPath)];
    }
    
    function lookupModule(name) {
    
        var m = module.searchScope(name);
        
        if (!m)
            throw new Error("Invalid module reference: " + name);
        
        return m;
    }
    
    if (module.ast) {
    
        visit(module.ast, true, false);
        
        moduleRefs.forEach((ref, name) => {
        
            var target = locals.has(name) ?
                locals.get(name) :
                lookupModule(name).reflexiveBinding;
            
            ref.edges.forEach(edge => target.addEdge(edge));
        });
    }
    
    module.children.forEach(buildGraph);
}