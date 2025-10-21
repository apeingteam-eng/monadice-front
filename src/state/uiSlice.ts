import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type UiState = {
  searchQuery: string;
  activeFilter: "Trending" | "Sports" | "Business" | "Entertainment" | "Crypto" | "Politics" | null;
};

const initialState: UiState = {
  searchQuery: "",
  activeFilter: "Trending",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setActiveFilter(state, action: PayloadAction<UiState["activeFilter"]>) {
      state.activeFilter = action.payload;
    },
    clearFilter(state) {
      state.activeFilter = null;
      state.searchQuery = "";
    },
  },
});

export const { setSearchQuery, setActiveFilter, clearFilter } = uiSlice.actions;
export default uiSlice.reducer;



