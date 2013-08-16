import { StringMap } from "StringMap.js";

export var
    GRAY = "GRAY",
    BLACK = "BLACK",
    GREEN = "GREEN",
    YELLOW = "YELLOW",
    RED = "RED",
    REFLEXIVE = "|";

export class BindingEdge {

    constructor(binding, path) {
    
        this.binding = binding;
        this.path = path || [];
        this.star = false;
    }
}

export class Binding {

    constructor(map, name) {

        // Backlink to binding map
        this.map = map;
        this.name = name;
        this.color = GRAY;
        
        // Bindings which reference this node
        this.edges = [];
    
        // The binding target
        this.targetModule = null;
        this.targetName = null;
        
        if (this.map)
            this.map.unresolved += 1;
    }
    
    get resolved() { 
    
        return !!this.targetModule;
    }
    
    get target() { 
    
        return this.targetModule ? 
            this.targetModule.bindingTargets.get(this.targetName) : 
            void 0;
    }

    // Resolves the binding to a binding target
    resolve(module, name, color) {

        var wasResolved = this.resolved;
        
        this.targetModule = module;
        this.targetName = name;
    
        if (!wasResolved && this.resolved && this.map)
            this.map.unresolved -= 1;
        
        this.color = color || GREEN;
        
        return this;
    }

    // Adds an edge to the node
    addEdge(edge) {

        this.edges.push(edge);
        
        var b = edge.binding;
        
        if (b.color === GRAY)
            b.color = BLACK;
    }
    
    // Creates a new edge and adds it to the node
    createEdge(binding, path) {
    
        var b = new BindingEdge(binding, path);
        this.addEdge(b);
        return b;
    }
}

export class BindingMap extends StringMap {

    constructor() {
    
        super();
        this.starEdges = [];
        this.unresolved = 0;
    }
    
    get resolved() { return this.unresolved === 0; }

    add(name) {

        var b;
        
        if (!this.has(name)) {

            this.set(name, b = new Binding(this, name));
        
        } else {
    
            b = this.get(name);
        }
    
        return b;
    }
    
    addNew(name) {
    
        if (this.has(name))
            throw new Error(`Duplicate binding name: [${ name }].`);
        
        var b = new Binding(this, name);
        this.set(name, b);
        return b;
    }

    addStarEdge(source) {

        this.starEdges.push(source);
    }
    
}