**Name:** Chetan Chauhan

**Week Ending:** 10-13-2025

### Courses Completed

* Completed the **remaining part of Lesson 1** from the CKB Academy:

  * **Dep Cells & Code Hashing (Code Location and Execution)**

    * Learned that CKB executes scripts by referencing external **dep cells** that contain the code.
    * Understood how **code_hash** is used to locate and verify the correct lock or type script.
    * Studied what happens when dep cells are destroyed and how built-in scripts remain permanently accessible.
  * **Execution & Grouping Rules**

    * Explored how **script grouping** optimizes transaction execution by grouping similar scripts for batch validation.
    * Understood how **CKB-VM** executes scripts deterministically to ensure consistent validation across all nodes.
  * **Constructing a Transaction (Destroying & Creating Cells)**

    * Learned that every transaction in CKB **destroys input cells** and **creates new output cells**, maintaining a balanced capacity.
    * Analyzed how each input references a live cell and how witnesses provide proof for unlocking it.
    * Observed the role of **cell_deps** during transaction validation for script access.
  * **Lesson 1 Summary (Practical Understanding)**

    * Tied all previous concepts together — from cell structure to execution flow.
    * Gained a complete view of how transactions are constructed, validated, and finalized in CKB.
    * Understood how the combination of **lock**, **type**, **cell_deps**, and **witnesses** creates a modular and secure transaction system.

### Key Learnings

* Understood how **Dep Cells** store executable code and are referenced during validation.
* Learned the importance of **code_hash** and **hash_type** in ensuring script integrity.
* Realized that **grouping rules** enhance performance while maintaining determinism.
* Gained confidence in understanding the **transaction lifecycle** — from creation to execution.
* Developed clarity on the **core logic of CKB** as a flexible and secure blockchain platform.

### Practical Progress

* Explored how dep cells are referenced in real transactions using **CKB Explorer**.
* Visualized and documented how **inputs**, **outputs**, and **cell_deps** interact.
* Wrote a personal summary diagram connecting all Lesson 1 components for future reference.
* Began preparing to construct a sample transaction using **CKB CLI tools** in the coming week.

### Environment

* Continued using the [CKB Documentation](https://docs.nervos.org/) for practical references.
* Set up a local environment ready for **CKB node testing** and **script experimentation**.
* Organized notes, diagrams, and references for future lessons involving **on-chain development**.

