## Week 07

**Date:** 11th - 18th Nov, 2025

### Tasks Completed

- Completed the full [Getting Started With Script Development Module](https://nervos.gitbook.io/developer-training-course) from the Developer Training Course [CKB Academy](https://academy.ckb.dev/) covering:
  - Accessing Cell Data  
  - Script Groups  
  - Using Script Args  
  - Managing Script State  
  - Counter & DoubleCounter Labs  
  - DataRange Lab  
- Successfully implemented and tested all labs using Capsule (`capsule build` + `capsule test`).

<table style="width:100%; text-align:center;">
  <tr>
    <td style="width:50%; vertical-align:top; text-align:center;">
      <img src="https://github.com/user-attachments/assets/d79af4ee-f295-475d-b1dd-2e50a5c48223" width="100%">
      <p>1. Accessing Cell Data – Started</p>
    </td>
    <td style="width:50%; vertical-align:top; text-align:center;">
      <img src="https://github.com/user-attachments/assets/c21973a2-3562-493d-9d2f-155911383c8b" width="100%">
      <p>2. Accessing Cell Data – Completed</p>
    </td>
  </tr>
</table>


### Key Concepts Learned

- Understood **how cells store data** and how type scripts validate data length, encoding, and structure.
- Learned **Script Groups (GroupInput / GroupOutput)** and why they simplify validation.
- Explored **script args** to dynamically pass parameters to the type script (e.g., DataCap limits).
- Understood **script state management** using Counter & DoubleCounter patterns.

### Labs Completed

- **Data10 → AlwaysSuccess Conversion**
- **JSONCell Type Script Implementation**
- **DataCap → DataRange Type Script**
- **Counter Type Script**
- **DoubleCounter Type Script**
  
All labs were built & tests passed:
```bash
capsule build
capsule test
```
### Key Skills Gained

- Working with `QueryIter`, `load_cell_data`, `load_cell`, and group-based syscalls (`GroupInput` / `GroupOutput`).
- Converting between binary formats → integers (`u32`, `u64`, `u128` LE byte encoding).
- Understanding and implementing the **Minimal Concern Pattern** for efficient script logic.
- Using **Capsule**, **Rust no_std**, and **CKB-STD APIs** to build and test type scripts.
- Writing and validating scripts using `capsule build` + `capsule test`.

---

### References

- [Accessing Cell Data – CKB Academy](https://nervos.gitbook.io/developer-training-course/scripting-basics/accessing-cell-data)
- [Script Groups – CKB Academy](https://nervos.gitbook.io/developer-training-course/scripting-basics/script-groups)
- [Using Script Args – CKB Academy](https://nervos.gitbook.io/developer-training-course/scripting-basics/using-script-args)
- [Managing Script State – CKB Academy](https://nervos.gitbook.io/developer-training-course/scripting-basics/managing-script-state)
- [SUDT Token Standard (Rust Implementation)](https://github.com/nervosnetwork/ckb-miscellaneous-scripts)









