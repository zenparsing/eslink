module Path from "node:path";

import { parseModule, forEachChild } from "package:es6parse";
import { Module } from "Module.js";
import { isPackageURI, locatePackage } from "PackageLocator.js";
import { AsyncFS, StringMap, StringSet } from "package:zen-bits";

var EXTERNAL_URL = /[a-z][a-z]+:/i;

function resolveURI(path, dir) {

    if (isPackageURI(path))
        return locatePackage(path);
    
    if (EXTERNAL_URL.test(path))
        return Promise.resolve(path);
    
    return Promise.resolve(Path.resolve(dir, path));
}

export function buildTree(startPath) {

    startPath = Path.resolve(startPath);
    
    var root = new Module,
        visited = new StringSet,
        pending = 0,
        resolver,
        promise = new Promise((resolve, reject) => resolver = { resolve, reject });
    
    function visit(uri, baseURI, resolveMap) {

        ++pending;
        
        return resolveURI(uri, baseURI).then(path => {
        
            if (resolveMap)
                resolveMap.set(uri, path);
            
            if (visited.has(path))
                return;
            
            visited.add(path);
            
            return AsyncFS
            .readFile(path, { encoding: "utf8" })
            .then(code => code, err => null)
            .then(code => {
    
                var node = root.addChild(Module.stringName(path)),
                    base = Path.dirname(path),
                    depMap;
            
                if (code !== null) {
            
                    node.ast = parseModule(code);
                    node.source = code;
                    node.dependencies = depMap = analyze(node);
                    
                    depMap.keys().forEach(key => visit(key, base, depMap));
                }
            
            });
            
        }).then($=> {
        
            if (--pending === 0)
                resolver.resolve(root);
        });
    }
    
    visit(startPath, "", null);
    
    return promise;
}

function analyze(module) {

    var edges = new StringMap;
    
    function visit(node, parent) {
        
        switch (node.type) {
        
            case "ModuleDeclaration":
                
                parent = parent.addChild(node.identifier.value);
                parent.ast = node.body;
                parent.source = module.source;
                node = node.body;
                break;
        
            case "ExportsList":
            case "ImportDeclaration":
            case "ModuleImport":
                
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
        
        var path = spec.value;
        
        if (path && !edges.has(path))
            edges.set(path, null);
    }
    
    visit(module.ast, module);
    
    return edges;
}
