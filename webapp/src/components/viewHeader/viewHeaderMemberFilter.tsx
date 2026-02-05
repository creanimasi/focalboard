// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useRef, useEffect} from 'react'
import ReactDOM from 'react-dom'
import {useIntl} from 'react-intl'

import {useAppSelector, useAppDispatch} from '../../store/hooks'
import {getBoardUsers} from '../../store/users'
import {IUser} from '../../user'
import CompassIcon from '../../widgets/icons/compassIcon'
import Button from '../../widgets/buttons/button'
import UserAvatar from '../userAvatar'

import {RootState} from '../../store/index'

import './viewHeaderMemberFilter.scss'

// Local selectors to avoid circular import
const getMemberFilterIdsLocal = (state: RootState): string[] => state.memberFilter?.memberIds || []

const ViewHeaderMemberFilter = () => {
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const [showDropdown, setShowDropdown] = useState(false)
    const [searchText, setSearchText] = useState('')
    const [localMemberIds, setLocalMemberIds] = useState<string[]>([])
    const buttonRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    
    // Get board users from store
    const boardUsersById = useAppSelector<{[key: string]: IUser}>(getBoardUsers)
    const boardUsers = Object.values(boardUsersById)
    
    // Get current filter from store
    const selectedMemberIds = useAppSelector(getMemberFilterIdsLocal)
    
    const hasActiveFilter = selectedMemberIds.length > 0
    
    // Filter users by search
    const filteredUsers = boardUsers.filter(user => {
        const searchLower = searchText.toLowerCase()
        return (
            user.username?.toLowerCase().includes(searchLower) ||
            user.nickname?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower)
        )
    })
    
    // Toggle member selection
    const toggleMember = (userId: string) => {
        if (selectedMemberIds.includes(userId)) {
            const newIds = selectedMemberIds.filter(id => id !== userId)
            dispatch({type: 'memberFilter/setMemberFilter', payload: newIds})
        } else {
            dispatch({type: 'memberFilter/setMemberFilter', payload: [...selectedMemberIds, userId]})
        }
    }
    
    // Clear all filters
    const handleClearFilter = () => {
        dispatch({type: 'memberFilter/clearMemberFilter'})
    }
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setShowDropdown(false)
            }
        }
        
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showDropdown])
    
    // Get selected users for display
    const selectedUsers = selectedMemberIds.map(id => boardUsersById[id]).filter(Boolean)
    
    // Calculate dropdown position
    const getDropdownPosition = () => {
        if (!buttonRef.current) return {top: 0, left: 0}
        const rect = buttonRef.current.getBoundingClientRect()
        return {
            top: rect.bottom + 8,
            left: Math.min(rect.left, window.innerWidth - 300)
        }
    }
    
    const dropdownPosition = getDropdownPosition()
    
    // Dropdown content
    const dropdownContent = showDropdown ? ReactDOM.createPortal(
        <div 
            ref={dropdownRef}
            className='member-filter-dropdown'
            style={{
                position: 'fixed',
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                zIndex: 10000
            }}
        >
            <div className='dropdown-header'>
                <span className='dropdown-title'>
                    {intl.formatMessage({id: 'ViewHeader.filterByMember', defaultMessage: 'Filter by member'})}
                </span>
                {hasActiveFilter && (
                    <button className='clear-btn' onClick={handleClearFilter}>
                        {intl.formatMessage({id: 'ViewHeader.clearFilter', defaultMessage: 'Clear'})}
                    </button>
                )}
            </div>
            
            <input
                type='text'
                className='member-search'
                placeholder={intl.formatMessage({id: 'ViewHeader.searchMembers', defaultMessage: 'Search members...'})}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                autoFocus
            />
            
            <div className='member-list'>
                {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => {
                        const displayName = user.nickname || user.username || user.email || 'Unknown'
                        const isSelected = selectedMemberIds.includes(user.id)
                        
                        return (
                            <div 
                                key={user.id}
                                className={`member-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleMember(user.id)}
                            >
                                <UserAvatar
                                    userId={user.id}
                                    name={displayName}
                                    size='small'
                                    className='member-avatar'
                                />
                                <div className='member-info'>
                                    <span className='member-name'>{displayName}</span>
                                    {user.username && user.username !== displayName && (
                                        <span className='member-username'>@{user.username}</span>
                                    )}
                                </div>
                                {isSelected && (
                                    <CompassIcon icon='check' className='check-icon'/>
                                )}
                            </div>
                        )
                    })
                ) : (
                    <div className='empty-state'>
                        {boardUsers.length === 0 ? (
                            <p>{intl.formatMessage({id: 'ViewHeader.noMembers', defaultMessage: 'No board members'})}</p>
                        ) : (
                            <p>{intl.formatMessage({id: 'ViewHeader.noMembersFound', defaultMessage: 'No members found'})}</p>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    ) : null
    
    return (
        <div className='ViewHeaderMemberFilter' ref={buttonRef}>
            <Button
                active={hasActiveFilter}
                onClick={() => setShowDropdown(!showDropdown)}
            >
                {hasActiveFilter ? (
                    selectedUsers.length === 1 
                        ? (selectedUsers[0].nickname || selectedUsers[0].username || 'Member')
                        : `${selectedUsers.length} members`
                ) : (
                    intl.formatMessage({id: 'ViewHeader.members', defaultMessage: 'Members'})
                )}
            </Button>
            {dropdownContent}
        </div>
    )
}

export default React.memo(ViewHeaderMemberFilter)
