import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaImage, FaEye, FaArrowUp, FaArrowDown, FaGripVertical } from 'react-icons/fa';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import axios from 'axios';
import toast from 'react-hot-toast';
import ConfirmationPopup from "../../components/modal/ConfirmationPopup";
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { MdOutlineEdit } from "react-icons/md";
import { RiDeleteBin6Line } from "react-icons/ri";

const Menugames = () => {
  const base_url = import.meta.env.VITE_API_KEY_Base_URL;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [formData, setFormData] = useState({
    uuid: '',
    category: 'exclusive',
    categoryname: 'Exclusive',
    name: '',
    gameId: '',
    provider: '',
    serial: ''
  });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  
  // Image states
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${base_url}/api/admin/menu-games`);
      setGames(response.data);
    } catch (error) {
      console.error('Error fetching games:', error);
      toast.error('Failed to fetch games');
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleGame = async (id) => {
    try {
      const response = await axios.get(`${base_url}/api/admin/menu-games/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching single game:', error);
      toast.error('Failed to fetch game details');
      return null;
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size should be less than 10MB');
        return;
      }
      
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setCurrentImage(null);
    if (document.getElementById('imageInput')) {
      document.getElementById('imageInput').value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isEditing && !imageFile) {
      toast.error('Please select an image');
      return;
    }
    
    if (!formData.name) {
      toast.error('Game name is required');
      return;
    }
    
    if (!formData.gameId) {
      toast.error('Game ID is required');
      return;
    }

    if (!formData.provider) {
      toast.error('Provider is required');
      return;
    }

    try {
      setLoading(true);
      
      const formDataObj = new FormData();
      formDataObj.append('uuid', formData.uuid);
      formDataObj.append('category', formData.category);
      formDataObj.append('categoryname', formData.categoryname);
      formDataObj.append('name', formData.name);
      formDataObj.append('gameId', formData.gameId);
      formDataObj.append('provider', formData.provider);
      formDataObj.append('status', 'true');
      
      // Include serial if editing and provided
      if (isEditing && formData.serial !== '') {
        formDataObj.append('serial', formData.serial);
      }
      
      if (imageFile) {
        formDataObj.append('image', imageFile);
      }

      if (isEditing) {
        await axios.put(`${base_url}/api/admin/menu-games/${editingId}`, formDataObj, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success('Game updated successfully');
      } else {
        await axios.post(`${base_url}/api/admin/menu-games`, formDataObj, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success('Game created successfully');
      }

      resetForm();
      fetchGames();
    } catch (error) {
      console.error('Error saving game:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save game';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      uuid: '',
      category: 'exclusive',
      categoryname: 'Exclusive',
      name: '',
      gameId: '',
      provider: '',
      serial: ''
    });
    setImageFile(null);
    setImagePreview(null);
    setCurrentImage(null);
    setIsEditing(false);
    setEditingId(null);
    if (document.getElementById('imageInput')) {
      document.getElementById('imageInput').value = '';
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await axios.put(`${base_url}/api/admin/menu-games/${id}/status`, {
        status: !currentStatus
      });
      
      setGames(games.map(game => 
        game._id === id ? { ...game, status: !currentStatus } : game
      ));
      
      toast.success(`Game ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  const editGame = async (game) => {
    try {
      const freshGameData = await fetchSingleGame(game._id);
      if (freshGameData) {
        setFormData({
          uuid: freshGameData.uuid || '',
          category: freshGameData.category || 'exclusive',
          categoryname: freshGameData.categoryname || 'Exclusive',
          name: freshGameData.name || '',
          gameId: freshGameData.gameId || '',
          provider: freshGameData.provider || '',
          serial: freshGameData.serial !== undefined ? freshGameData.serial.toString() : ''
        });
        
        if (freshGameData.image) {
          setCurrentImage(`${base_url}${freshGameData.image}`);
          setImagePreview(null);
          setImageFile(null);
        } else {
          setCurrentImage(null);
        }
        
        setIsEditing(true);
        setEditingId(game._id);
        
        const formElement = document.querySelector('form');
        if (formElement) {
          formElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } catch (error) {
      console.error('Error preparing edit:', error);
      toast.error('Failed to load game for editing');
    }
  };

  const cancelEdit = () => {
    resetForm();
  };

  const confirmDelete = (game) => {
    setGameToDelete(game);
    setShowDeletePopup(true);
  };

  const deleteGame = async () => {
    if (!gameToDelete) return;
    
    try {
      await axios.delete(`${base_url}/api/admin/menu-games/${gameToDelete._id}`);
      setGames(games.filter(game => game._id !== gameToDelete._id));
      toast.success('Game deleted successfully');
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error(error.response?.data?.error || 'Failed to delete game');
    } finally {
      setShowDeletePopup(false);
      setGameToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeletePopup(false);
    setGameToDelete(null);
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `${base_url}${imagePath}`;
  };

  // ==================== DRAG AND DROP REORDERING ====================
  
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const items = Array.from(games);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update local state for smooth UI
    setGames(items);
    
    // Prepare data for API
    const reorderedData = items.map((game, index) => ({
      _id: game._id,
      serial: index + 1
    }));
    
    try {
      setIsReordering(true);
      await axios.put(`${base_url}/api/admin/menu-games/reorder`, {
        games: reorderedData
      });
      toast.success('Game order updated successfully');
    } catch (error) {
      console.error('Error reordering games:', error);
      toast.error('Failed to update game order');
      // Re-fetch to restore correct order
      fetchGames();
    } finally {
      setIsReordering(false);
    }
  };

  // Move game up/down with buttons
  const moveGame = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= games.length) return;
    
    const items = Array.from(games);
    const [movedItem] = items.splice(index, 1);
    items.splice(newIndex, 0, movedItem);
    
    setGames(items);
    
    const reorderedData = items.map((game, idx) => ({
      _id: game._id,
      serial: idx + 1
    }));
    
    try {
      await axios.put(`${base_url}/api/admin/menu-games/reorder`, {
        games: reorderedData
      });
      toast.success('Game moved successfully');
    } catch (error) {
      console.error('Error moving game:', error);
      toast.error('Failed to move game');
      fetchGames();
    }
  };

  return (
    <section className="min-h-screen bg-[#0F111A] text-gray-200 font-poppins">
      <Header toggleSidebar={toggleSidebar} />

      <div className="flex pt-[10vh]">
        <Sidebar isOpen={isSidebarOpen} />

        <main
          className={`transition-all duration-300 flex-1 p-6 overflow-y-auto h-[90vh] ${
            isSidebarOpen ? 'md:ml-[40%] lg:ml-[28%] xl:ml-[17%]' : 'ml-0'
          }`}
        >
          <div className="w-full mx-auto">
            <div className="rounded-lg mb-8 flex flex-col md:flex-row justify-between items-center">
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tighter uppercase">Menu Games - Exclusive Category</h1>
                <p className="text-xs font-bold text-gray-500 mt-1">Manage exclusive games for the menu section</p>
              </div>
              <div className="flex items-center gap-3 mt-2 md:mt-0">
                <span className="text-xs text-gray-500">Total: {games.length}</span>
                <span className="text-xs text-gray-500">|</span>
                <span className="text-xs text-gray-500">Active: {games.filter(g => g.status).length}</span>
              </div>
            </div>
            
            {/* Add/Edit Game Form */}
            <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6 mb-8 shadow-2xl">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-6">
                <div className="w-1 h-4 bg-indigo-500"></div>
                {isEditing ? 'Edit Game' : 'Add New Game'}
              </h3>
              
              <form onSubmit={handleSubmit}>
                {/* Image Upload Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Game Image {!isEditing && <span className="text-red-500">*</span>}
                  </label>
                  
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="w-48 h-48 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center bg-[#0F111A] overflow-hidden relative">
                      {imagePreview ? (
                        <>
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={removeImage}
                            className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors z-10"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </>
                      ) : currentImage ? (
                        <>
                          <img 
                            src={currentImage} 
                            alt="Current" 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={removeImage}
                              className="bg-red-600 text-white rounded-full p-2 hover:bg-red-700 transition-colors"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 text-center">
                            Current Image
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <FaImage className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No image selected</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="mb-4">
                        <input
                          type="file"
                          id="imageInput"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="imageInput"
                          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer transition-colors text-sm"
                        >
                          <FaImage className="mr-2" />
                          {imagePreview || currentImage ? 'Change Image' : 'Select Image'}
                        </label>
                        {(imagePreview || currentImage) && (
                          <button
                            type="button"
                            onClick={removeImage}
                            className="ml-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Supported formats: JPG, PNG, GIF (Max size: 10MB)</p>
                      {isEditing && !imagePreview && currentImage && (
                        <p className="text-xs text-blue-400 mt-2">* Leave image empty to keep current image</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* UUID Field */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    UUID
                  </label>
                  <input
                    type="text"
                    name="uuid"
                    value={formData.uuid}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F111A] border border-gray-700 rounded-[3px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-200"
                    placeholder="Enter UUID"
                  />
                </div>

                {/* Serial Field - Only show when editing */}
                {isEditing && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Serial Number
                    </label>
                    <input
                      type="number"
                      name="serial"
                      value={formData.serial}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-4 py-2 bg-[#0F111A] border border-gray-700 rounded-[3px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-200"
                      placeholder="Enter serial number"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty to keep current position
                    </p>
                  </div>
                )}

                {/* Category Name (Read-only) */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                  <input
                    type="text"
                    value="Exclusive"
                    className="w-full px-4 py-2 border border-gray-700 rounded-[3px] bg-[#0F111A] text-gray-500 cursor-not-allowed"
                    disabled
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    All games are automatically assigned to the Exclusive category
                  </p>
                </div>

                {/* Game Name Field */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Game Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F111A] border border-gray-700 rounded-[3px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-200"
                    placeholder="Enter game name"
                    required
                  />
                </div>

                {/* Provider Field */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Provider <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="provider"
                    value={formData.provider}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F111A] border border-gray-700 rounded-[3px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-200"
                    placeholder="Enter provider name"
                    required
                  />
                </div>

                {/* Game ID Field */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Game ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="gameId"
                    value={formData.gameId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0F111A] border border-gray-700 rounded-[3px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-200"
                    placeholder="Enter game ID"
                    required
                  />
                </div>
                
                {/* Submit Buttons */}
                <div className="flex justify-end mt-8 space-x-4">
                  {isEditing && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-6 py-2 bg-gray-700 text-white font-medium rounded-md hover:bg-gray-600 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {isEditing ? 'Updating...' : 'Creating...'}
                      </span>
                    ) : (isEditing ? 'Update Game' : 'Add Game')}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Games Table with Drag and Drop */}
            <div className="">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-indigo-500"></div>
                Exclusive Games List ({games.length})
              </h3>
              
              {loading && games.length === 0 ? (
                <div className="bg-[#161B22] rounded-lg p-12 border border-gray-800 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4" viewBox="0 0 24 24"></svg>
                    <p className="text-gray-500">Loading games...</p>
                  </div>
                </div>
              ) : games.length === 0 ? (
                <div className="bg-[#161B22] p-12 rounded-lg text-center border border-gray-800">
                  <FaImage className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">No exclusive games found. Add your first game above.</p>
                </div>
              ) : (
                <div className="border border-gray-800 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="games-list">
                        {(provided) => (
                          <table 
                            className="min-w-full divide-y divide-gray-800"
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                          >
                            <thead className="bg-[#1C2128]">
                              <tr>
                                <th className="px-4 py-4 text-left text-xs md:text-sm font-semibold text-indigo-400 uppercase tracking-wider w-12">
                                  #
                                </th>
                                <th className="px-6 py-4 text-left text-xs md:text-sm font-semibold text-indigo-400 uppercase tracking-wider w-12">
                                  <FaGripVertical className="text-gray-500" />
                                </th>
                                <th className="px-6 py-4 text-left text-xs md:text-sm font-semibold text-indigo-400 uppercase tracking-wider">Image</th>
                                <th className="px-6 py-4 text-left text-xs md:text-sm font-semibold text-indigo-400 uppercase tracking-wider">UUID</th>
                                <th className="px-6 py-4 text-left text-xs md:text-sm font-semibold text-indigo-400 uppercase tracking-wider">Game Name</th>
                                <th className="px-6 py-4 text-left text-xs md:text-sm font-semibold text-indigo-400 uppercase tracking-wider">Provider</th>
                                <th className="px-6 py-4 text-left text-xs md:text-sm font-semibold text-indigo-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs md:text-sm font-semibold text-indigo-400 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-[#161B22] divide-y divide-gray-800">
                              {games.map((game, index) => (
                                <Draggable key={game._id} draggableId={game._id} index={index}>
                                  {(provided, snapshot) => (
                                    <tr 
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className={`hover:bg-[#1F2937] transition-colors duration-150 ${
                                        snapshot.isDragging ? 'bg-[#1F2937] shadow-2xl border-2 border-indigo-500' : ''
                                      }`}
                                    >
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-400 text-center">
                                        {index + 1}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap" {...provided.dragHandleProps}>
                                        <div className="flex flex-col items-center">
                                          <button
                                            onClick={() => moveGame(index, 'up')}
                                            disabled={index === 0}
                                            className={`p-1 rounded hover:bg-gray-700 transition-colors ${
                                              index === 0 ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'
                                            }`}
                                          >
                                            <FaArrowUp className="w-3 h-3" />
                                          </button>
                                          <FaGripVertical className="text-gray-600 my-1" />
                                          <button
                                            onClick={() => moveGame(index, 'down')}
                                            disabled={index === games.length - 1}
                                            className={`p-1 rounded hover:bg-gray-700 transition-colors ${
                                              index === games.length - 1 ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'
                                            }`}
                                          >
                                            <FaArrowDown className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                          {game.image ? (
                                            <div className="relative group">
                                              <img 
                                                src={getImageUrl(game.image)} 
                                                alt={game.name}
                                                className="w-12 h-12 object-cover rounded-lg border border-gray-700"
                                                onError={(e) => {
                                                  e.target.src = 'https://via.placeholder.com/64x64?text=No+Image';
                                                }}
                                              />
                                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <button
                                                  onClick={() => window.open(getImageUrl(game.image), '_blank')}
                                                  className="text-white text-xs bg-blue-600 px-2 py-1 rounded hover:bg-blue-700"
                                                >
                                                  <FaEye className="w-3 h-3" />
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="w-12 h-12 bg-[#0F111A] rounded-lg border border-gray-700 flex items-center justify-center">
                                              <FaImage className="text-gray-600 w-6 h-6" />
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <code className="text-xs text-gray-400 bg-[#0F111A] px-2 py-1 rounded font-mono">
                                          {game.uuid || 'N/A'}
                                        </code>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-white font-medium">{game.name}</div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full text-xs font-medium border border-blue-700">
                                          {game.provider || 'N/A'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                          <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={game.status === true}
                                            onChange={() => toggleStatus(game._id, game.status)}
                                          />
                                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                          <span className={`ml-3 text-sm font-medium ${game.status ? 'text-green-500' : 'text-red-500'}`}>
                                            {game.status ? 'Active' : 'Inactive'}
                                          </span>
                                        </label>
                                      </td>
                                {/* Action buttons */}
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
  <div className="flex items-center space-x-2">
    {/* View Button - Deep Blue */}
    <button
      onClick={() => window.open(getImageUrl(game.image), '_blank')}
      className="p-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded transition-colors shadow-sm hover:shadow-md"
      title="View Image"
    >
      <FaEye className="w-4 h-4" />
    </button>
    
    {/* Edit Button - Deep Green */}
    <button
      onClick={() => editGame(game)}
      className="p-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded transition-colors shadow-sm hover:shadow-md"
      title="Edit Game"
    >
      <MdOutlineEdit className="w-4 h-4" />
    </button>
    
    {/* Delete Button - Deep Red */}
    <button
      onClick={() => confirmDelete(game)}
      className="p-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded transition-colors cursor-pointer shadow-sm hover:shadow-md"
      title="Delete Game"
    >
      <RiDeleteBin6Line className="w-4 h-4" />
    </button>
  </div>
</td>
                                    </tr>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </tbody>
                          </table>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                  <div className="bg-[#1C2128] px-6 py-3 border-t border-gray-800 flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      Drag the grip icon <FaGripVertical className="inline text-gray-600 mx-1" /> to reorder
                    </span>
                    {isReordering && (
                      <span className="text-xs text-indigo-400 flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating order...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {showDeletePopup && (
        <ConfirmationPopup
          title="Delete Game"
          message={`Are you sure you want to delete "${gameToDelete?.name}"? This action cannot be undone.`}
          onConfirm={deleteGame}
          onCancel={cancelDelete}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
    </section>
  );
};

export default Menugames;