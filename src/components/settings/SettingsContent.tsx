'use client'
import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { User, Shield, Palette, Bell, Download, Trash2, Edit3, Save, X } from 'lucide-react'

export default function SettingsContent() {
    const { data: session } = useSession()
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [profileData, setProfileData] = useState({
        name: session?.user?.name || '',
        email: session?.user?.email || ''
    })

    const handleSaveProfile = () => {
        // TODO: Implement profile update API call
        setIsEditingProfile(false)
    }

    const handleCancelEdit = () => {
        setProfileData({
            name: session?.user?.name || '',
            email: session?.user?.email || ''
        })
        setIsEditingProfile(false)
    }

    const handleExportData = () => {
        // TODO: Implement data export functionality
        alert('Data export functionality coming soon!')
    }

    const handleDeleteAccount = () => {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            // TODO: Implement account deletion
            alert('Account deletion functionality coming soon!')
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Profile Section */}
            <div className="bg-white rounded-xl border border-brown-light/20 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brown-light/30 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-ink" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-ink">Profile Information</h3>
                            <p className="text-sm text-ink/60">Manage your personal information</p>
                        </div>
                    </div>
                    {!isEditingProfile && (
                        <button
                            onClick={() => setIsEditingProfile(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-brown-medium text-white rounded-lg hover:bg-brown-dark transition-colors"
                        >
                            <Edit3 className="w-4 h-4" />
                            Edit
                        </button>
                    )}
                </div>

                {isEditingProfile ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-ink mb-2">Name</label>
                            <input
                                type="text"
                                value={profileData.name}
                                onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-brown-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-light/30"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-ink mb-2">Email</label>
                            <input
                                type="email"
                                value={profileData.email}
                                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full px-3 py-2 border border-brown-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-light/30"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveProfile}
                                className="flex items-center gap-2 px-4 py-2 bg-brown-medium text-white rounded-lg hover:bg-brown-dark transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                Save Changes
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-ink border border-brown-light/20 rounded-lg hover:bg-stone-light transition-colors"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-ink/60 mb-1">Name</label>
                            <p className="text-ink">{session?.user?.name || 'Not set'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-ink/60 mb-1">Email</label>
                            <p className="text-ink">{session?.user?.email}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Preferences Section */}
            <div className="bg-white rounded-xl border border-brown-light/20 p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Palette className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-ink">Preferences</h3>
                        <p className="text-sm text-ink/60">Customize your writing experience</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-ink">Auto-save</h4>
                            <p className="text-sm text-ink/60">Automatically save documents while typing</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" defaultChecked className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brown-light/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brown-medium"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-ink">Dark mode</h4>
                            <p className="text-sm text-ink/60">Switch to dark theme</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brown-light/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brown-medium"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-ink">Notifications</h4>
                            <p className="text-sm text-ink/60">Receive email notifications</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brown-light/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brown-medium"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Security Section */}
            <div className="bg-white rounded-xl border border-brown-light/20 p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Shield className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-ink">Security</h3>
                        <p className="text-sm text-ink/60">Manage your account security</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <button className="w-full text-left p-4 border border-brown-light/20 rounded-lg hover:bg-stone-light transition-colors">
                        <h4 className="font-medium text-ink mb-1">Change Password</h4>
                        <p className="text-sm text-ink/60">Update your account password</p>
                    </button>

                    <button className="w-full text-left p-4 border border-brown-light/20 rounded-lg hover:bg-stone-light transition-colors">
                        <h4 className="font-medium text-ink mb-1">Two-Factor Authentication</h4>
                        <p className="text-sm text-ink/60">Add an extra layer of security</p>
                    </button>
                </div>
            </div>

            {/* Data Management Section */}
            <div className="bg-white rounded-xl border border-brown-light/20 p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Download className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-ink">Data Management</h3>
                        <p className="text-sm text-ink/60">Export or delete your data</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleExportData}
                        className="w-full text-left p-4 border border-brown-light/20 rounded-lg hover:bg-stone-light transition-colors"
                    >
                        <h4 className="font-medium text-ink mb-1">Export Data</h4>
                        <p className="text-sm text-ink/60">Download all your documents and data</p>
                    </button>

                    <button
                        onClick={handleDeleteAccount}
                        className="w-full text-left p-4 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        <h4 className="font-medium text-red-600 mb-1">Delete Account</h4>
                        <p className="text-sm text-red-500">Permanently delete your account and all data</p>
                    </button>
                </div>
            </div>

            {/* Sign Out Section */}
            <div className="bg-white rounded-xl border border-brown-light/20 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium text-ink">Sign Out</h3>
                        <p className="text-sm text-ink/60">Sign out of your account</p>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    )
}
