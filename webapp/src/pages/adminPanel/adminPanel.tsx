// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useCallback} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {IUser} from '../../user'
import Button from '../../widgets/buttons/button'
import IconButton from '../../widgets/buttons/iconButton'
import EditIcon from '../../widgets/icons/edit'
import DeleteIcon from '../../widgets/icons/delete'
import ConfirmationDialogBox, {ConfirmationDialogBoxProps} from '../../components/confirmationDialogBox'
import UserAvatar from '../../components/userAvatar'

import AdminUserEditDialog from './adminUserEditDialog'

import './adminPanel.scss'

type AdminUser = IUser

const AdminPanel = (): JSX.Element => {
    const intl = useIntl()
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [confirmDialog, setConfirmDialog] = useState<ConfirmationDialogBoxProps | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/v2/admin/users', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('focalboardSessionId'),
                    'X-Requested-With': 'XMLHttpRequest',
                },
            })
            
            if (response.status === 401) {
                setError(intl.formatMessage({id: 'AdminPanel.unauthorized', defaultMessage: 'Anda tidak memiliki akses ke Admin Panel'}))
                setLoading(false)
                return
            }
            
            if (!response.ok) {
                throw new Error('Failed to fetch users')
            }
            
            const data = await response.json()
            setUsers(data || [])
        } catch (err) {
            setError(intl.formatMessage({id: 'AdminPanel.error', defaultMessage: 'Gagal memuat daftar pengguna'}))
            console.error('Error fetching users:', err)
        } finally {
            setLoading(false)
        }
    }, [intl])

    useEffect(() => {
        fetchUsers()
    }, [fetchUsers])

    const handleEditUser = (user: AdminUser) => {
        setEditingUser(user)
        setShowEditDialog(true)
    }

    const handleDeleteUser = (user: AdminUser) => {
        const confirmProps: ConfirmationDialogBoxProps = {
            heading: intl.formatMessage({id: 'AdminPanel.deleteUser', defaultMessage: 'Hapus Pengguna'}),
            subText: intl.formatMessage(
                {id: 'AdminPanel.deleteUserConfirm', defaultMessage: 'Apakah Anda yakin ingin menghapus pengguna "{username}"?'},
                {username: user.username}
            ),
            confirmButtonText: intl.formatMessage({id: 'AdminPanel.delete', defaultMessage: 'Hapus'}),
            onConfirm: async () => {
                try {
                    const response = await fetch(`/api/v2/admin/users/${user.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + localStorage.getItem('focalboardSessionId'),
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    })
                    
                    if (response.ok) {
                        fetchUsers()
                    } else {
                        const data = await response.json()
                        alert(data.error || 'Failed to delete user')
                    }
                } catch (err) {
                    console.error('Error deleting user:', err)
                    alert('Failed to delete user')
                }
                setConfirmDialog(null)
            },
            onClose: () => setConfirmDialog(null),
        }
        setConfirmDialog(confirmProps)
    }

    const handleSaveUser = async (userData: {username: string, email: string, password?: string}) => {
        if (!editingUser) return

        try {
            const response = await fetch(`/api/v2/admin/users/${editingUser.id}`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('focalboardSessionId'),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(userData),
            })
            
            if (response.ok) {
                setShowEditDialog(false)
                setEditingUser(null)
                fetchUsers()
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to update user')
            }
        } catch (err) {
            console.error('Error updating user:', err)
            alert('Failed to update user')
        }
    }

    const formatDate = (timestamp: number) => {
        if (!timestamp) return '-'
        return new Date(timestamp).toLocaleString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className='AdminPanel'>
            <div className='AdminPanel__header'>
                <h1>
                    <FormattedMessage
                        id='AdminPanel.title'
                        defaultMessage='Admin Panel'
                    />
                </h1>
                <p className='AdminPanel__subtitle'>
                    <FormattedMessage
                        id='AdminPanel.subtitle'
                        defaultMessage='Kelola semua pengguna di sistem Crmboard'
                    />
                </p>
            </div>

            <div className='AdminPanel__content'>
                <div className='AdminPanel__toolbar'>
                    <div className='AdminPanel__search'>
                        <input
                            type='text'
                            placeholder={intl.formatMessage({id: 'AdminPanel.searchPlaceholder', defaultMessage: 'Cari pengguna...'})}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className='AdminPanel__stats'>
                        <span className='AdminPanel__userCount'>
                            <FormattedMessage
                                id='AdminPanel.totalUsers'
                                defaultMessage='{count} pengguna'
                                values={{count: users.length}}
                            />
                        </span>
                    </div>
                </div>

                {loading && (
                    <div className='AdminPanel__loading'>
                        <FormattedMessage
                            id='AdminPanel.loading'
                            defaultMessage='Memuat...'
                        />
                    </div>
                )}

                {error && (
                    <div className='AdminPanel__error'>
                        <span>{error}</span>
                        <Button onClick={fetchUsers}>
                            <FormattedMessage
                                id='AdminPanel.retry'
                                defaultMessage='Coba Lagi'
                            />
                        </Button>
                    </div>
                )}

                {!loading && !error && (
                    <div className='AdminPanel__table-container'>
                        <table className='AdminPanel__table'>
                            <thead>
                                <tr>
                                    <th>
                                        <FormattedMessage
                                            id='AdminPanel.user'
                                            defaultMessage='Pengguna'
                                        />
                                    </th>
                                    <th>
                                        <FormattedMessage
                                            id='AdminPanel.email'
                                            defaultMessage='Email'
                                        />
                                    </th>
                                    <th>
                                        <FormattedMessage
                                            id='AdminPanel.createdAt'
                                            defaultMessage='Dibuat'
                                        />
                                    </th>
                                    <th>
                                        <FormattedMessage
                                            id='AdminPanel.updatedAt'
                                            defaultMessage='Diperbarui'
                                        />
                                    </th>
                                    <th>
                                        <FormattedMessage
                                            id='AdminPanel.actions'
                                            defaultMessage='Aksi'
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className='AdminPanel__empty'>
                                            <FormattedMessage
                                                id='AdminPanel.noUsers'
                                                defaultMessage='Tidak ada pengguna ditemukan'
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(user => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className='AdminPanel__userCell'>
                                                    <UserAvatar
                                                        userId={user.id}
                                                        name={user.username}
                                                        size='small'
                                                        className='AdminPanel__avatar'
                                                    />
                                                    <span className='AdminPanel__username'>{user.username}</span>
                                                </div>
                                            </td>
                                            <td>{user.email}</td>
                                            <td>{formatDate(user.create_at)}</td>
                                            <td>{formatDate(user.update_at)}</td>
                                            <td>
                                                <div className='AdminPanel__actions'>
                                                    <IconButton
                                                        icon={<EditIcon/>}
                                                        title={intl.formatMessage({id: 'AdminPanel.editUser', defaultMessage: 'Edit'})}
                                                        onClick={() => handleEditUser(user)}
                                                    />
                                                    <IconButton
                                                        icon={<DeleteIcon/>}
                                                        title={intl.formatMessage({id: 'AdminPanel.deleteUser', defaultMessage: 'Hapus'})}
                                                        onClick={() => handleDeleteUser(user)}
                                                        className='danger'
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showEditDialog && editingUser && (
                <AdminUserEditDialog
                    user={editingUser}
                    onSave={handleSaveUser}
                    onClose={() => {
                        setShowEditDialog(false)
                        setEditingUser(null)
                    }}
                />
            )}

            {confirmDialog && (
                <ConfirmationDialogBox
                    dialogBox={confirmDialog}
                />
            )}
        </div>
    )
}

export default AdminPanel
