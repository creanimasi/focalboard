// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {RootState} from './index'

interface MemberFilterState {
    memberIds: string[]
}

const initialState: MemberFilterState = {
    memberIds: [],
}

const memberFilterSlice = createSlice({
    name: 'memberFilter',
    initialState,
    reducers: {
        setMemberFilter: (state, action: PayloadAction<string[]>) => {
            state.memberIds = action.payload
        },
        clearMemberFilter: (state) => {
            state.memberIds = []
        },
        toggleMemberFilter: (state, action: PayloadAction<string>) => {
            const userId = action.payload
            const index = state.memberIds.indexOf(userId)
            if (index === -1) {
                state.memberIds.push(userId)
            } else {
                state.memberIds.splice(index, 1)
            }
        },
    },
})

export const {setMemberFilter, clearMemberFilter, toggleMemberFilter} = memberFilterSlice.actions
export const memberFilterReducer = memberFilterSlice.reducer

// Selectors
export const getMemberFilterIds = (state: RootState): string[] => state.memberFilter?.memberIds || []
export const hasMemberFilter = (state: RootState): boolean => (state.memberFilter?.memberIds || []).length > 0
