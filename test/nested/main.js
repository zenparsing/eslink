module M {

    export module N {
    
        var x = 0;
        
        import { y } from O;
        export { x, y };
    }
    
    module O {
    
        export var y = 0;
    }
    
}

module X = M.N;

import { x, y } from X;
export { x, y };