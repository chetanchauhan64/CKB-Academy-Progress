# Week 06 Report  
**Date:** 03 Nov – 10 Nov, 2025  

---

## Tasks Completed  

### • Learned Conditional Logic (`if` Expressions)
Understood how to use `if` conditions to make decisions in Rust.  
Also explored using `match` for comparison-based branching.  

```rust
fn bigger(a: i32, b: i32) -> i32 {
    // Returns the bigger number between a and b
    match a > b {
        true => a,
        false => b,
    }
}

fn main() {
    println!("Bigger: {}", bigger(12, 8));
}
```

### • Studied Booleans (bool)
Practiced defining boolean variables and using logical negation with !.

```rust
fn main() {
    let is_morning = true;
    if is_morning {
        println!("Good morning!");
    }

    let is_evening: bool = !is_morning;
    if is_evening {
        println!("Good evening!");
    }
}
```
### • Explored Basic Rust Scripts

Learned how to write and execute simple Rust scripts using the fn main() entry point.
Also practiced using comments, variables, and formatted print statements.

```rust
fn main() {
    let name = "Chetan";
    let year = 2025;
    println!("Welcome to Rust scripting, {}! Year: {}", name, year);
}
```
### • Practiced Loops (loop, while, for)

Explored different looping mechanisms in Rust.
Learned how to use loops to iterate, break, and continue effectively.

```rust
fn main() {
    for num in 1..=5 {
        println!("Counting: {}", num);
    }

    let mut i = 0;
    while i < 3 {
        println!("While loop count: {}", i);
        i += 1;
    }

    let mut n = 0;
    loop {
        if n == 2 {
            break;
        }
        println!("Infinite loop iteration: {}", n);
        n += 1;
    }
}
```
### • Worked with Strings & Methods

Explored how to modify and manipulate strings using built-in methods like push_str() and len().

```rust
fn main() {
    let mut msg = String::from("Hello");
    msg.push_str(", Rustacean!");
    println!("Message: {}", msg);
    println!("Length: {}", msg.len());
}
```
### • Continued Learning  

Continued progress through the [Rust Programming Basics - Cyfrin Updraft](https://updraft.cyfrin.io/courses/rust-programming-basics)  
and the [Rust Book - Official Rust Documentation](https://doc.rust-lang.org/book/title-page.html)

### • Tech Terms Covered
- Conditional Logic (if, match)
- Booleans (bool, logical negation)
- Rust Script Setup (fn main())
- Loops (for, while, loop)
- String Manipulation (push_str(), len())

### • References
- [Rust Programming Basics - Cyfrin Updraft](https://updraft.cyfrin.io/courses/rust-programming-basics)
- [Rust Book - Official Rust Documentation](https://doc.rust-lang.org/book/title-page.html)


