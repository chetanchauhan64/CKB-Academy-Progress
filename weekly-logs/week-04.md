# Week 04 Report  
**Date:** 15th - 21st Oct, 2025  

---

## Tasks Completed

### • Learned Variables in Rust
- Understood how to declare variables using `let`.
- Learned that immutability is the default behavior in Rust.

```rust 
let name = "Chetan"; // Immutable variable
let mut age = 21;    // Mutable variable
age += 1;
println!("{} is now {} years old.", name, age);
```

### • Explored Data Types

Studied integers, floats, booleans, characters, and tuples.

```rust 
let x: i32 = 10;
let pi: f64 = 3.14;
let is_rust_fun: bool = true;
let letter: char = 'R';
let tup: (i32, f64, char) = (42, 6.28, 'Z');
println!("Tuple values: {}, {}, {}", tup.0, tup.1, tup.2);
```
### • Understood Functions & Return Values

Learned how functions return values without an explicit `return` —  
the last expression becomes the return value automatically.

```rust 
fn add(a: i32, b: i32) -> i32 {
    a + b  // no semicolon means this is the return value
}

fn main() {
    println!("Sum: {}", add(5, 10)); 
}
```
### • Studied Ownership Rules

Understood how Rust ensures **memory safety** by transferring ownership.

```rust 
fn main() {
    let s1 = String::from("CKB");
    let s2 = s1; // ownership moves from s1 to s2
    // println!("{}", s1); // ❌ Error: s1 no longer valid
    println!("{}", s2);
}
```
### • Practiced Borrowing & References

Used `&` and `&mut` to **borrow data** without taking ownership.

 ```rust 
fn main() {
    let mut text = String::from("Hello");
    borrow_text(&text);
    modify_text(&mut text);
}

fn borrow_text(t: &String) {
    println!("Borrowed: {}", t);
}

fn modify_text(t: &mut String) {
    t.push_str(", Rust!");
    println!("Modified: {}", t);
}
```
### • Explored Scope & Lifetimes

Observed how variables are **automatically dropped** when they go out of scope.

 ```rust 
{
    let msg = String::from("Temporary message");
    println!("{}", msg);
} // msg is dropped here automatically
```

## • Continued Learning

Continued learning through the [Rust Programming Basics - Cyfrin Updraft](https://updraft.cyfrin.io/courses/rust-programming-basics)  
and cross-referenced with the [Rust Book - Official Rust Documentation](https://doc.rust-lang.org/book/title-page.html).


---

### • Tech Terms Covered
- Variables & Mutability (`let`, `mut`)
- Data Types (Scalar & Compound)
- Type Inference
- Functions (`fn`, return expressions)
- Ownership
- Borrowing & References (`&`, `&mut`)
- Scope & Lifetimes

---

### • References
- [Rust Programming Basics - Cyfrin Updraft](https://updraft.cyfrin.io/courses/rust-programming-basics)
- [Rust Book - Official Rust Documentation](https://doc.rust-lang.org/book/title-page.html)

