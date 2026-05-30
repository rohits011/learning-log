# Concurrency Basics in Java

Java provides built-in support for multithreaded programming. 

## Threads and Runnables
A `Thread` is the basic unit of execution. You can create a thread by extending the `Thread` class or implementing the `Runnable` interface.

```java
Runnable task = () -> {
    System.out.println("Running in a new thread!");
};
new Thread(task).start();
```

## Executors
For better resource management, use the `ExecutorService`:

```java
ExecutorService executor = Executors.newFixedThreadPool(10);
executor.submit(() -> System.out.println("Running from pool!"));
executor.shutdown();
```
