import { StringMap } from "StringMap.js";
import { BindingMap } from "Binding.js";

export class Module {

    constructor() {
    
        this.exports = new BindingMap(this);
        this.localBindings = new BindingMap;
        this.bindingTargets = new StringMap;
        
        this.children = new StringMap;
        this.parent = null;
        this.ast = null;
        this.dependencies = null;
        
        // Initialize reflexive binding
        this.bindingTargets.set("|", { type: "module", module: this });
        this.localBindings.add("|").resolve(this, "|");
    }
    
    get reflexiveBinding() { return this.localBindings.get("|"); }
    
    addChild(name, child) {
    
        if (this.children.has(name))
            throw new Error("Child module is already defined.");
        
        if (!child)
            child = new Module;
            
        this.children.set(name, child);
        child.parent = this;
        
        return child;
    }
    
    getPath() {
    
        var path = [], 
            prev = this,
            m;
        
        for (m = this.parent; m; m = m.parent) {
        
            m.children.forEach((c, key) => {
            
                if (c === prev) {
                    
                    path.push(key);
                    prev = null;
                }
            });
            
            prev = m;
        }
        
        return path.reverse().join(".");
    }
    
    searchScope(name) {
    
        for (var m = this; m; m = m.parent)
            if (m.children.has(name))
                return m.children.get(name);
        
        return null;
    }
    
    static stringName(name) {
    
        return "[" + name + "]";
    }
}
