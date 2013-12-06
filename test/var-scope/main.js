// Outer
var x1;
let y1;
const z1 = 0;

// Block
{
    var x2;
    let y2;
    const z2 = 0;
}

// Function Declaration
function F1(p1) {

    var x;
    let y;
    const z = 0;
}

// Generator Declaration
function* F2(p1) {

    var x;
    let y;
    const z = 0;
}

// Class Declaration
class C {

    x() {
    
        var x;
        let y;
        const z = 0;
    }
}

// Function Expression
(function(p1) {

    var x;
    let y;
    const z = 0;
});

// Generator Expression
(function*(p1) {

    var x;
    let y;
    const z = 0;
});

// Class Expression
(class {

    x() {
    
        var x;
        let y;
        const z = 0;
    }
});

// Arrow Functions
$=> {

    var x;
    let y;
    const z = 0;
};

// For Statements
for (var x3 of []);
for (let y3 of []);
for (var x4 in []);
for (let y4 in []);
for (var x5 = 0;;);
for (let x5 = 0;;);

// Statements with no-block bodies
if (true) var x6;
