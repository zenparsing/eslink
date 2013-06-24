module Path from "node:path";

import { readFile } from "AsyncFS.js";
import { parseModule, forEachChild } from "Parser.js";
import { Module } from "Module.js";
import { Promise } from "Promise.js";
import { StringSet } from "StringSet.js";

var EXTERNAL_URL = /[a-z][a-z]+:/i;

export function buildTree(startPath) {

    startPath = Path.resolve(startPath);
    
    var root = new Module,
        visited = new StringSet,
        pending = 0,
        resolver,
        promise = new Promise(r => resolver = r);
    
    function visit(path) {

        if (visited.has(path))
            return;
            
        visited.add(path);
        pending += 1;
        
        var dir = Path.dirname(path),
            resolvePath = p => EXTERNAL_URL.test(p) ? null : Path.resolve(dir, p);
        
        readFile(path, { encoding: "utf8" }).then(code => {
    
            var node = root.addChild(Module.stringName(path));
            
            node.ast = parseModule(code);
            node.dependencies = analyze(node, resolvePath);
            node.dependencies.forEach(visit);
            
            pending -= 1;
            
            if (pending === 0)
                resolver.resolve(root);
            
        }).catch(err => {
        
            resolver.reject(err);
            
        });
    }
    
    visit(startPath);
    
    return promise;
}

function sort(root, startPath) {

    var visited = new StringSet,
        list = [];
    
    function visit(path) {
    
        if (visited.has(path))
            return;
        
        visited.add(path);
        
        var module = root.children.get(Module.stringName(path));
        
        module.dependencies.forEach(visit);
        list.push(module);
    }
    
    visit(startPath);
    
    return list;
}

function analyze(module, resolvePath) {

    var edges = new StringSet;
    
    function visit(node, parent) {
        
        switch (node.type) {
        
            case "ModuleDeclaration":
                
                parent = parent.addChild(node.ident.value);
                parent.ast = node.body;
                return;
        
            case "ExportSpecifierSet":
            case "ImportDeclaration":
            case "ModuleFromDeclaration":
                
                addEdge(node.from);
                break;
            
            case "ClassExpression":
            case "ClassBody":
            case "FunctionExpression":
            case "FormalParameter":
            case "FunctionBody":
            
                return;
        }
        
        forEachChild(node, child => visit(child, parent));
    }
    
    function addEdge(spec) {
    
        if (!spec || spec.type !== "String")
            return;
        
        var path = resolvePath(spec.value);
        
        spec.resolvedPath = path;
        
        if (path && !edges.has(path))
            edges.add(path);
    }
    
    visit(module.ast, module);
    
    return edges.keys();
}
