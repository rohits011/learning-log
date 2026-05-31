# Java Basics

Java is a high-level, class-based, object-oriented programming language that is designed to have as few implementation dependencies as possible. It is a general-purpose programming language intended to let application developers *write once, run anywhere* (WORA).

## Core Concepts

- **Object-Oriented**: Everything in Java is an object, encapsulating state and behavior.
- **Platform-Independent**: Java code is compiled into bytecode, which can run on any platform with a Java Virtual Machine (JVM).
- **Strongly Typed**: Every variable must be declared with a data type.

## Basic Syntax

```java
public class HelloWorld {
    // The main method is the entry point of any Java application
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

## Primitives vs Objects

Java has 8 primitive data types (e.g., `int`, `boolean`, `double`, `char`), which are stored directly in memory for performance. Everything else is an object (e.g., `String`, arrays, user-defined classes), accessed via references.

## Key Principles of OOP in Java

1. **Encapsulation**: Hiding internal state and requiring all interaction to be performed through an object's methods.
2. **Inheritance**: Creating new classes from existing classes to promote code reuse (`extends`).
3. **Polymorphism**: The ability of different classes to respond to the same method call in their own way (method overriding/overloading).
4. **Abstraction**: Hiding complex implementation details and showing only the essential features of the object (`abstract` classes and interfaces).
