module Path from "node:path";

import { AsyncFS } from "package:zen-bits";

var PACKAGE_URI = /^package:/i,
    JS_PACKAGE_ROOT = process.env["JS_PACKAGE_ROOT"] || "",
    packageRoots;

export function isPackageURI(uri) {

    return PACKAGE_URI.test(uri);
}

export function locatePackage(uri) {
    
    return Promise.resolve().then($=> {
    
        var name = uri.replace(PACKAGE_URI, ""),
            rootList,
            path;
    
        if (name === uri)
            throw new Error("Not a package URI.");
    
        if (!packageRoots)
            packageRoots = JS_PACKAGE_ROOT.split(/;/g).map(v => v.trim());
    
        rootList = packageRoots.slice(0);
        
        var next = $=> {
        
            if (rootList.length === 0)
                throw new Error(`Package ${name} could not be found.`);
            
            var root = rootList.shift(),
                path = Path.join(Path.resolve(root, name), "main.js");
            
            return AsyncFS.stat(path).then(stat => {
            
                return stat && stat.isFile() ? path : next();
                
            }, next);
        };
        
        return next();
        
    });
}