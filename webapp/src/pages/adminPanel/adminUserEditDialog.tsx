// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import Dialog from '../../components/dialog'
import Button from '../../widgets/buttons/button'

import './adminUserEditDialog.scss'

interface AdminUser {
    id: string
    username: string
    email: string
}

interface Props {
    user: AdminUser
    onSave: (userData: {username: string, email: string, password?: string}) => void
    onClose: () => void
}

const AdminUserEditDialog = ({user, onSave, onClose}: Props): JSX.Element => {
    const intl = useIntl()
    const [username, setUsername] = useState(user.username)
    const [email, setEmail] = useState(user.email)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [errors, setErrors] = useState<{username?: string, email?: string, password?: string}>({})

    const validateForm = () => {
        const newErrors: {username?: string, email?: string, password?: string} = {}
        
        if (!username.trim()) {
            newErrors.username = intl.formatMessage({id: 'AdminUserEditDialog.usernameRequired', defaultMessage: 'Username wajib diisi'})
        }
        
        if (!email.trim()) {
            newErrors.email = intl.formatMessage({id: 'AdminUserEditDialog.emailRequired', defaultMessage: 'Email wajib diisi'})
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = intl.formatMessage({id: 'AdminUserEditDialog.emailInvalid', defaultMessage: 'Format email tidak valid'})
        }
        
        if (password && password.length < 6) {
            newErrors.password = intl.formatMessage({id: 'AdminUserEditDialog.passwordTooShort', defaultMessage: 'Password minimal 6 karakter'})
        }
        
        if (password && password !== confirmPassword) {
            newErrors.password = intl.formatMessage({id: 'AdminUserEditDialog.passwordMismatch', defaultMessage: 'Password tidak cocok'})
        }
        
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!validateForm()) {
            return
        }
        
        const userData: {username: string, email: string, password?: string} = {
            username: username.trim(),
            email: email.trim(),
        }
        
        if (password) {
            userData.password = password
        }
        
        onSave(userData)
    }

    return (
        <Dialog
            onClose={onClose}
            title={
                <FormattedMessage
                    id='AdminUserEditDialog.title'
                    defaultMessage='Edit Pengguna'
                />
            }
        >
            <form onSubmit={handleSubmit} className='AdminUserEditDialog'>
                <div className='AdminUserEditDialog__field'>
                    <label htmlFor='username'>
                        <FormattedMessage
                            id='AdminUserEditDialog.username'
                            defaultMessage='Username'
                        />
                    </label>
                    <input
                        id='username'
                        type='text'
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={intl.formatMessage({id: 'AdminUserEditDialog.usernamePlaceholder', defaultMessage: 'Masukkan username'})}
                    />
                    {errors.username && <span className='error'>{errors.username}</span>}
                </div>

                <div className='AdminUserEditDialog__field'>
                    <label htmlFor='email'>
                        <FormattedMessage
                            id='AdminUserEditDialog.email'
                            defaultMessage='Email'
                        />
                    </label>
                    <input
                        id='email'
                        type='email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={intl.formatMessage({id: 'AdminUserEditDialog.emailPlaceholder', defaultMessage: 'Masukkan email'})}
                    />
                    {errors.email && <span className='error'>{errors.email}</span>}
                </div>

                <div className='AdminUserEditDialog__divider'>
                    <span>
                        <FormattedMessage
                            id='AdminUserEditDialog.changePassword'
                            defaultMessage='Ganti Password (opsional)'
                        />
                    </span>
                </div>

                <div className='AdminUserEditDialog__field'>
                    <label htmlFor='password'>
                        <FormattedMessage
                            id='AdminUserEditDialog.newPassword'
                            defaultMessage='Password Baru'
                        />
                    </label>
                    <input
                        id='password'
                        type='password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={intl.formatMessage({id: 'AdminUserEditDialog.passwordPlaceholder', defaultMessage: 'Masukkan password baru'})}
                    />
                </div>

                <div className='AdminUserEditDialog__field'>
                    <label htmlFor='confirmPassword'>
                        <FormattedMessage
                            id='AdminUserEditDialog.confirmPassword'
                            defaultMessage='Konfirmasi Password'
                        />
                    </label>
                    <input
                        id='confirmPassword'
                        type='password'
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={intl.formatMessage({id: 'AdminUserEditDialog.confirmPasswordPlaceholder', defaultMessage: 'Konfirmasi password baru'})}
                    />
                    {errors.password && <span className='error'>{errors.password}</span>}
                </div>

                <div className='AdminUserEditDialog__actions'>
                    <Button
                        onClick={onClose}
                        emphasis='tertiary'
                    >
                        <FormattedMessage
                            id='AdminUserEditDialog.cancel'
                            defaultMessage='Batal'
                        />
                    </Button>
                    <Button
                        submit={true}
                        filled={true}
                    >
                        <FormattedMessage
                            id='AdminUserEditDialog.save'
                            defaultMessage='Simpan'
                        />
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}

export default AdminUserEditDialog
