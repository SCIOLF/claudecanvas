// Stub — sera implémenté en Task 6
use super::PtyHandle;

pub struct PtyManager {
    _phantom: std::marker::PhantomData<PtyHandle>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self { _phantom: std::marker::PhantomData }
    }
}
