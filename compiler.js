use pycj

// 1. String Multiplication
output("-" * 30)
imagine line = "=" * 10
output(line)

// 2. Default Parameters
function greet(name = "Guest") {
    output("Hello {name}!")
}
greet("Arshman")
greet()

// 3. Multiple Return Values & Destructuring
function get_coords() {
    return 10, 20
}

imagine x, y = get_coords()
output("X: {x}, Y: {y}")

end(0);
