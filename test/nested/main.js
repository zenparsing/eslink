module M {

    export module N {
    
        export var x = 0;
    }
}

module X = M.N;

import { x } from X;

export { x };