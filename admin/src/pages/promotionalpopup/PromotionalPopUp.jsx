import React, { useState, useEffect } from 'react';
import { FaUpload, FaTimes, FaEdit, FaTrash, FaPlus, FaEye, FaSearch, FaFilter, FaSort, FaSortUp, FaSortDown, FaCheckCircle, FaTimesCircle, FaClock, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import { FiRefreshCw, FiTrendingUp, FiDownload } from 'react-icons/fi';
import { FaRegFileImage } from "react-icons/fa6";
import { toast, Toaster } from 'react-hot-toast';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { FaCalendarAlt } from "react-icons/fa";

const PromotionalPopUp = () => {
  const base_url = import.meta.env.VITE_API_KEY_Base_URL;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [formData, setFormData] = useState({
    link: '',
    image: null
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [popups, setPopups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPopup, setEditingPopup] = useState(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [popupToDelete, setPopupToDelete] = useState(null);
  const [filter, setFilter] = useState({
    status: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Fetch popups on component mount
  useEffect(() => {
    fetchPopups();
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  const fetchPopups = async (filters = {}) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.status !== '' && filters.status !== undefined) queryParams.append('status', filters.status);
      if (searchTerm) queryParams.append('search', searchTerm);
      
      const url = `${base_url}/api/admin/promotional-popups${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPopups(data.data || []);
      } else {
        console.error('Failed to fetch popups');
        toast.error('Failed to fetch popups');
      }
    } catch (error) {
      console.error('Error fetching popups:', error);
      toast.error('Error fetching popups');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const newFilter = {
      ...filter,
      [name]: value
    };
    setFilter(newFilter);
    fetchPopups(newFilter);
  };

  const clearFilters = () => {
    setFilter({ status: '' });
    setSearchTerm('');
    fetchPopups();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File is too large. Maximum size is 10MB`);
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFormData({
          ...formData,
          image: file
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setFormData({
      ...formData,
      image: null
    });
    // Reset file input
    const fileInput = document.getElementById('image-upload');
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.image) {
      toast.error('Please upload an image');
      return;
    }
    
    if (!formData.link) {
      toast.error('Please enter a link');
      return;
    }
    
    try {
      setLoading(true);
      const uploadData = new FormData();
      uploadData.append('link', formData.link);
      uploadData.append('image', formData.image);
      
      const response = await fetch(`${base_url}/api/admin/promotional-popups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: uploadData
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Popup created:', result);
        
        // Reset form and refresh popups
        setFormData({ link: '', image: null });
        setImagePreview(null);
        fetchPopups(filter);
        toast.success('Promotional popup created successfully!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to create popup');
      }
    } catch (error) {
      console.error('Error creating popup:', error);
      toast.error('Error creating popup');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      const response = await fetch(`${base_url}/api/admin/promotional-popups/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: !currentStatus })
      });
      
      if (response.ok) {
        fetchPopups(filter);
        toast.success('Popup status updated successfully');
      } else {
        toast.error('Failed to update popup status');
      }
    } catch (error) {
      console.error('Error updating popup status:', error);
      toast.error('Error updating popup status');
    }
  };

  const confirmDelete = (popup) => {
    setPopupToDelete(popup);
    setShowDeletePopup(true);
  };

  const cancelDelete = () => {
    setShowDeletePopup(false);
    setPopupToDelete(null);
  };

  const deletePopup = async () => {
    if (!popupToDelete) return;
    
    try {
      const response = await fetch(`${base_url}/api/admin/promotional-popups/${popupToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        fetchPopups(filter);
        toast.success('Popup deleted successfully');
      } else {
        toast.error('Failed to delete popup');
      }
    } catch (error) {
      console.error('Error deleting popup:', error);
      toast.error('Error deleting popup');
    } finally {
      setShowDeletePopup(false);
      setPopupToDelete(null);
    }
  };

  const startEdit = (popup) => {
    setEditingPopup(popup);
    setFormData({ 
      link: popup.link,
      image: null 
    });
    setImagePreview(null);
  };

  const cancelEdit = () => {
    setEditingPopup(null);
    setFormData({ 
      link: '',
      image: null 
    });
    setImagePreview(null);
    // Reset file input
    const fileInput = document.getElementById('image-upload');
    if (fileInput) fileInput.value = '';
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.link) {
      toast.error('Please enter a link');
      return;
    }
    
    try {
      setLoading(true);
      const editData = new FormData();
      editData.append('link', formData.link);
      
      if (formData.image) {
        // Validate file size (max 10MB)
        if (formData.image.size > 10 * 1024 * 1024) {
          toast.error('Image is too large. Maximum size is 10MB');
          setLoading(false);
          return;
        }
        editData.append('image', formData.image);
      }
      
      const response = await fetch(`${base_url}/api/admin/promotional-popups/${editingPopup._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: editData
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Popup updated:', result);
        
        // Reset form and refresh popups
        setEditingPopup(null);
        setFormData({ link: '', image: null });
        setImagePreview(null);
        fetchPopups(filter);
        toast.success('Popup updated successfully!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update popup');
      }
    } catch (error) {
      console.error('Error updating popup:', error);
      toast.error('Error updating popup');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="text-gray-600 inline ml-1" />;
    if (sortConfig.direction === 'ascending') return <FaSortUp className="text-indigo-400 inline ml-1" />;
    return <FaSortDown className="text-indigo-400 inline ml-1" />;
  };

  const sortedPopups = React.useMemo(() => {
    let sortableItems = [...popups];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        if (sortConfig.key === 'createdAt') {
          aValue = aValue ? new Date(aValue) : new Date(0);
          bValue = bValue ? new Date(bValue) : new Date(0);
        }
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [popups, sortConfig]);

  const paginatedPopups = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedPopups.slice(startIndex, endIndex);
  }, [sortedPopups, currentPage]);

  const totalPages = Math.ceil(popups.length / itemsPerPage);

  const getPaginationPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const inputClass = 'w-full bg-[#0F111A] border border-gray-700 text-gray-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-indigo-500 placeholder-gray-600';
  const selectClass = 'w-full bg-[#0F111A] border border-gray-700 text-gray-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-indigo-500';

  if (loading && popups.length === 0) {
    return (
      <section className="min-h-screen bg-[#0F111A] text-gray-200 font-poppins">
        <Header toggleSidebar={toggleSidebar} />
        <div className="flex pt-[10vh]">
          <Sidebar isOpen={isSidebarOpen} />
          <main className={`transition-all duration-300 flex-1 p-6 overflow-y-auto h-[90vh] ${isSidebarOpen ? 'md:ml-[40%] lg:ml-[28%] xl:ml-[17%]' : 'ml-0'}`}>
            <div className="flex items-center justify-center h-full">
              <FaSpinner className="animate-spin text-indigo-400 text-3xl" />
            </div>
          </main>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#0F111A] text-gray-200 font-poppins">
      <Header toggleSidebar={toggleSidebar} />

      {/* Delete Confirmation Popup */}
      {showDeletePopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm p-4">
          <div className="bg-[#161B22] border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-200 mb-4">Confirm Delete</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete this promotional popup? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-[#0F111A] border border-gray-700 text-gray-300 rounded text-xs font-bold hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deletePopup}
                className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded text-xs font-bold hover:bg-rose-500/30 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex pt-[10vh]">
        <Sidebar isOpen={isSidebarOpen} />

        <main
          className={`transition-all duration-300 flex-1 p-6 overflow-y-auto h-[90vh] ${
            isSidebarOpen ? 'md:ml-[40%] lg:ml-[28%] xl:ml-[17%] ' : 'ml-0'
          }`}
        >
          {/* Page Header */}
          <div className="rounded-lg mb-8 flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tighter uppercase">Promotional Popups</h1>
              <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-2">
                <FaCalendarAlt className="text-indigo-500" /> Manage promotional popups with image and link
              </p>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
              <button
                onClick={() => fetchPopups(filter)}
                className="bg-[#1F2937] hover:bg-indigo-600 border border-gray-700 px-6 py-2 rounded font-bold text-xs transition-all flex items-center gap-2"
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} /> REFRESH
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'TOTAL POPUPS', value: popups.length, color: 'border-indigo-500', valueClass: 'text-white' },
              { label: 'ACTIVE', value: popups.filter(p => p.status).length, color: 'border-emerald-500', valueClass: 'text-emerald-400' },
              { label: 'INACTIVE', value: popups.filter(p => !p.status).length, color: 'border-amber-500', valueClass: 'text-amber-400' },
            ].map((card, i) => (
              <div key={i} className={`bg-[#161B22] border-l-4 ${card.color} p-5 rounded shadow-lg border-y border-r border-gray-800`}>
                <div className="flex justify-between items-start mb-3">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{card.label}</p>
                  <FiTrendingUp className="text-gray-700" />
                </div>
                <h2 className={`text-xl font-bold mt-1 leading-none ${card.valueClass}`}>{card.value}</h2>
              </div>
            ))}
          </div>

          {/* Filter Section */}
          <div className="bg-[#161B22] border border-gray-800 rounded-lg p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <div className="w-1 h-4 bg-indigo-500"></div> Filters & Search
              </h2>
              <button
                onClick={clearFilters}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider"
              >
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && fetchPopups(filter)}
                  className={`${inputClass} pl-8`}
                  placeholder="Search..."
                />
              </div>
              <select
                name="status"
                value={filter.status}
                onChange={handleFilterChange}
                className={selectClass}
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {/* Add/Edit Popup Form */}
          <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-indigo-500"></div> {editingPopup ? 'Edit Popup' : 'Add New Popup'}
            </h2>
            <form onSubmit={editingPopup ? handleEditSubmit : handleSubmit}>
              {/* Link Field */}
              <div className="mb-6">
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Link *</label>
                <input
                  type="url"
                  name="link"
                  value={formData.link}
                  onChange={handleInputChange}
                  className={inputClass}
                  placeholder="Enter URL (e.g., https://example.com)"
                  required
                />
              </div>
              
              {/* Image Upload Section */}
              <div className="mb-8">
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  {editingPopup ? 'New Image (Optional)' : 'Image *'}
                </label>
                
                {/* Preview of selected image */}
                {imagePreview && (
                  <div className="mb-4">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Selected Image:</h3>
                    <div className="relative border border-gray-700 rounded-md p-2 inline-block bg-[#0F111A]">
                      <img 
                        src={imagePreview} 
                        alt="Popup preview" 
                        className="h-48 w-auto object-cover rounded-md max-w-xs"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-1 right-1 bg-rose-500 cursor-pointer text-white p-1 rounded-full text-xs"
                      >
                        <FaTimes />
                      </button>
                      <p className="text-[10px] text-center mt-1 truncate text-gray-400 max-w-xs">
                        {formData.image?.name || 'Image'}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Current image when editing */}
                {editingPopup && !imagePreview && (
                  <div className="mb-4">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Current Image:</h3>
                    <div className="relative border border-gray-700 rounded-md p-2 inline-block bg-[#0F111A]">
                      <img 
                        src={`${base_url}/${editingPopup.image}`} 
                        alt="Current popup" 
                        className="h-48 w-auto object-cover rounded-md max-w-xs"
                      />
                    </div>
                  </div>
                )}
                
                {/* Upload area */}
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:bg-[#1F2937] transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FaRegFileImage className="w-10 h-10 mb-3 text-gray-600" />
                      <p className="mb-2 text-xs text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-[10px] text-gray-600">
                        PNG, JPG, GIF up to 10MB
                      </p>
                      {imagePreview && (
                        <p className="text-[10px] text-indigo-400 mt-2">
                          Image selected
                        </p>
                      )}
                    </div>
                    <input 
                      id="image-upload"
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              </div>
              
              {/* Submit/Cancel Buttons */}
              <div className="flex justify-end mt-8 space-x-4">
                {editingPopup && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-6 py-2 bg-[#0F111A] border border-gray-700 text-gray-300 font-bold text-xs rounded-md hover:border-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={(!formData.image && !editingPopup) || !formData.link}
                >
                  {loading ? 'Processing...' : editingPopup ? 'Update Popup' : 'Create Popup'}
                </button>
              </div>
            </form>
          </div>
          
          {/* Popups Table */}
          <div className="">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <div className="w-1 h-4 bg-indigo-500"></div> All Popups
              </h2>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                {popups.length} popup(s) found
              </div>
            </div>
            
            {loading && popups.length === 0 ? (
              <div className="text-center py-8 flex justify-center">
                <FaSpinner className="animate-spin text-indigo-400 text-2xl" />
              </div>
            ) : popups.length === 0 ? (
              <div className="text-center py-16 bg-[#161B22] border border-gray-800 rounded-lg">
                <div className="flex flex-col items-center text-gray-600">
                  <FaSearch className="text-4xl mb-3 opacity-20" />
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">No popups found</p>
                  <p className="text-xs mt-1">Start by adding a promotional popup</p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-[#161B22] border border-gray-800 rounded-lg overflow-hidden shadow-2xl">
                  <div className="bg-[#1C2128] px-6 py-4 border-b border-gray-800 font-black text-[10px] text-indigo-400 uppercase tracking-widest">
                    Popup List
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead className="bg-[#0F111A] text-[9px] text-gray-500 uppercase">
                        <tr>
                          <th className="px-5 py-3">Image</th>
                          <th className="px-5 py-3 cursor-pointer" onClick={() => requestSort('link')}>
                            Link {getSortIcon('link')}
                          </th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 cursor-pointer" onClick={() => requestSort('createdAt')}>
                            Created {getSortIcon('createdAt')}
                          </th>
                          <th className="px-5 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {paginatedPopups.map((popup) => (
                          <tr key={popup._id} className="hover:bg-[#1F2937] transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="h-16 w-24 flex-shrink-0">
                                <img 
                                  className="h-16 w-24 rounded-md object-cover border border-gray-700" 
                                  src={`${base_url}/${popup.image}`} 
                                  alt="Popup" 
                                />
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-xs font-medium text-gray-200 truncate max-w-xs">{popup.link}</div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer" 
                                  checked={popup.status}
                                  onChange={() => toggleStatus(popup._id, popup.status)}
                                />
                                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                <span className="ml-2 text-[10px] font-medium">
                                  {popup.status ? (
                                    <span className="text-emerald-400">Active</span>
                                  ) : (
                                    <span className="text-rose-400">Inactive</span>
                                  )}
                                </span>
                              </label>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-[10px] text-gray-400">
                              {formatDate(popup.createdAt)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="flex gap-2">
                                <button 
                                  className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/30 border border-indigo-500/20 text-indigo-400 rounded text-xs transition-all"
                                  onClick={() => startEdit(popup)}
                                  title="Edit Popup"
                                >
                                  <FaEdit />
                                </button>
                                <button 
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/20 text-rose-400 rounded text-xs transition-all"
                                  onClick={() => confirmDelete(popup)}
                                  title="Delete Popup"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-5 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                      Page {currentPage} of {totalPages} &nbsp;·&nbsp; {popups.length} total
                    </p>
                    <nav className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                          currentPage === 1
                            ? 'bg-[#1C2128] border-gray-800 text-gray-700 cursor-not-allowed'
                            : 'bg-[#1C2128] border-gray-700 text-gray-300 hover:bg-indigo-600 hover:border-indigo-500'
                        }`}
                      >
                        ← Prev
                      </button>

                      {getPaginationPages().map((page, idx) =>
                        page === '...' ? (
                          <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-xs text-gray-600 font-bold select-none">
                            ···
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                              currentPage === page
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-[#1C2128] border-gray-700 text-gray-300 hover:bg-indigo-600/30 hover:border-indigo-500/50'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      )}

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                          currentPage === totalPages
                            ? 'bg-[#1C2128] border-gray-800 text-gray-700 cursor-not-allowed'
                            : 'bg-[#1C2128] border-gray-700 text-gray-300 hover:bg-indigo-600 hover:border-indigo-500'
                        }`}
                      >
                        Next →
                      </button>
                    </nav>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </section>
  );
};

export default PromotionalPopUp;