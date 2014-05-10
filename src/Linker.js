import { Module } from "Module.js";

import {

    Binding,
    BindingMap,
    BindingEdge,
    GRAY,
    BLACK,
    YELLOW,
    GREEN,
    RED,
    REFLEXIVE

} from "Binding.js";


class StarBinding extends Binding {

    constructor(targetMap) {
    
        super();
        this.targetMap = targetMap;
    }
}

function isVarScope(node) {

    switch (node.type) {
    
        // TODO:  What about function-in-block?
        case "ClassExpression":
        case "ClassBody":
        case "FunctionExpression":
        case "GeneratorExpression":
        case "FormalParameter":
        case "FunctionBody":
            return true;
    }
    
    return false;
}

function isLexicalScope(node) {

    if (isVarScope(node))
        return true;
    
    switch (node.type) {
    
        case "Block":
        case "ForOfStatement":
        case "ForInStatement":
        case "ForStatement":
            return true;
    }
    
    return false;
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
    
        if (from === to)
            return;
        
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
        imports = module.imports,
        moduleRefs = new BindingMap,
        exportAll = false;
    
    function visit(node, topLevel, exporting) {
    
        if (isVarScope(node))
            return;
        
        var binding, path;
        
        switch (node.type) {
        
            // let x; const x; var x;
            case "VariableDeclaration":
                if (topLevel || node.kind === "var") getVariables(node, exporting);
                return;
            
            // function F() {}
            case "FunctionDeclaration":
                addTarget(node.identifier.value, exporting, { type: "function" });
                return;
            
            // class C {}
            case "ClassDeclaration":
                addTarget(node.identifier.value, exporting, { type: "class" });
                return;
            
            // module A {}
            case "ModuleDeclaration":
                addTarget(node.identifier.value, exporting, { type: "module", module: lookupModule(node.identifier.value) });
                return;
            
            // module A from "foo";
            case "ModuleImport":
            
                moduleRefs.add(moduleName(node.from)).createEdge(
                    locals.addNew(node.identifier.value),
                    []);

                return;
                
            // module A = B.C;
            case "ModuleAlias":
            
                moduleRefs.add(moduleName(node.path)).createEdge(
                    locals.addNew(node.identifier.value), 
                    modulePath(node.path).slice(1));
                    
                return;
            
            case "ExportsList":
                
                if (!node.specifiers) {
                
                    // export * from "foo";
                    // export * from A.B;
                    moduleRefs.add(moduleName(node.from)).createEdge(
                        new StarBinding(exports), 
                        modulePath(node.from).slice(1));
                
                } else {
                
                    // export { a, b, c as d };
                    node.specifiers.forEach(spec => {
                    
                        locals.add(spec.local.value).createEdge(
                            exports.addNew((spec.exported || spec.local).value));
                    });
                }
                
                return;
                
            case "ExportDeclaration":
            
                if (node.declaration.type !== "ExportsList") {
                
                    // export [declaration];
                    node.children().forEach(child => visit(child, topLevel, true));
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
                    importPath.push(spec.imported.value);
                    
                    var local = locals.addNew((spec.local || spec.imported).value);
                    local.imported = true;
                    
                    binding.createEdge(local, importPath);
                });
                
                break;
            
            // TODO:
            case "ImportDefaultDeclaration":
            
                // import x from "foo";
                // import x from A.B;
                break;
            
            default:
            
                if (isLexicalScope(node))
                    topLevel = false;
                
                break;
        }
        
        node.children().forEach(child => visit(child, topLevel));
    }
    
    function getVariables(node, exporting) {
    
        if (isVarScope(node))
            return;
        
        if (node.type === "Identifier" && node.context === "declaration")
            addTarget(node.value, exporting, { type: "variable" });
        
        node.children().forEach(c => getVariables(c, exporting));
    }
    
    function addTarget(name, exporting, value) {
    
        targets.set(name, value);
        
        var local = locals.addNew(name).resolve(module, name);
        
        if (exporting)
            local.createEdge(exports.addNew(name));
    }
    
    function getResolvedName(name) {
    
        return module.dependencies.get(name) || "";
    }
    
    function moduleName(node) {
    
        switch (node.type) {
        
            case "Identifier":
                return node.value;
            
            case "StringLiteral":
                return Module.stringName(getResolvedName(node.value));
            
            case "ModulePath":
                return modulePath(node).slice(0, 1).join("");
            
            default:
                throw new Error("Invalid node " + node.type);
        }
    }
    
    function modulePath(node) {
    
        if (node.type === "ModulePath")
            return node.elements.map(e => e.value);
        
        return [Module.stringName(getResolvedName(node.value))];
    }
    
    function lookupModule(name) {
    
        var m = module.searchScope(name);
        
        if (!m)
            throw new Error(`Invalid module reference: ${name}`);
        
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
        
        if (exportAll) {
        
            locals.forEach((binding, name) => {
            
                if (binding.edges.length === 0 && name !== REFLEXIVE)
                    binding.createEdge(exports.addNew(name));
            });
        }
    }
    
    module.children.forEach(buildGraph);
}
