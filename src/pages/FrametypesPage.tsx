import { useEffect, useState } from "react";
import { PlusIcon, PencilIcon, TrashIcon, ChevronLeft, Square } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { PostgrestError } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import type { FrameType, Profile, FrameTypeWithRules, SupabaseProfileWithCount } from "@/types/frametypes";
import type { Database } from "@/integrations/supabase/database.types";

type Tables = Database['public']['Tables']
type DbProfile = Tables['profiles']['Row'];

const FrametypesPage = () => {
  const navigate = useNavigate();
  const [selectedFrameType, setSelectedFrameType] = useState<FrameType | null>(null);
  const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false);
  const [isCreateProfileOpen, setIsCreateProfileOpen] = useState(false);
  const [frameTypes, setFrameTypes] = useState<FrameType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [loading, setLoading] = useState(true);

  // Carica i dati iniziali
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Esegue le chiamate in parallelo
      const [frameTypesResponse, profilesResponse] = await Promise.all([
        supabase
          .from('frame_types')
          .select(`
            id,
            label,
            frame_type_profile_rules (
              id,
              profile_id,
              height_multiplier,
              width_multiplier,
              profiles (
                id,
                name
              )
            )
          `),
        supabase
          .from('profiles')
          .select(`
            id,
            name,
            frame_type_profile_rules (count)
          `)
      ]);

      if (frameTypesResponse.error) throw frameTypesResponse.error;
      if (profilesResponse.error) throw profilesResponse.error;

      const frameTypesData = frameTypesResponse.data as unknown as FrameTypeWithRules[];
      const profilesData = profilesResponse.data as unknown as (DbProfile & { frame_type_profile_rules: { count: number }[] })[];

      // Formatta i dati delle tipologie
      const formattedFrameTypes = frameTypesData.map(type => ({
        id: type.id,
        label: type.label,
        profiles: type.frame_type_profile_rules.map(rule => ({
          profileId: rule.profile_id,
          profileName: rule.profiles.name,
          heightMultiplier: rule.height_multiplier,
          widthMultiplier: rule.width_multiplier
        }))
      }));

      const formattedProfiles = (profilesData || []).map(profile => ({
        id: profile.id,
        name: profile.name,
        usageCount: profile.frame_type_profile_rules?.length || 0
      }));

      setFrameTypes(formattedFrameTypes);
      setProfiles(formattedProfiles);
    } catch (error) {
      console.error('Errore nel caricamento dei dati:', error);
      if (error instanceof Error) {
        console.error('Dettagli errore:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFrameType = async () => {
    if (!newTypeName.trim()) {
      alert('Inserisci un nome per la tipologia');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('frame_types')
        .insert([{ label: newTypeName.trim() }])
        .select()
        .single();

      if (error) throw error;

      setFrameTypes([...frameTypes, { id: data.id, label: data.label, profiles: [] }]);
      setNewTypeName("");
      setIsCreateTypeOpen(false);
      await loadData(); // Ricarica i dati per aggiornare i conteggi
    } catch (error) {
      console.error('Errore nella creazione della tipologia:', error);
      alert('Errore nella creazione della tipologia. Riprova più tardi.');
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      alert('Inserisci un nome per il profilo');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{ name: newProfileName.trim() }])
        .select()
        .single();

      if (error) throw error;

      setProfiles([...profiles, { id: data.id, name: data.name, usageCount: 0 }]);
      setNewProfileName("");
      setIsCreateProfileOpen(false);
    } catch (error) {
      console.error('Errore nella creazione del profilo:', error);
      alert('Errore nella creazione del profilo. Riprova più tardi.');
    }
  };

  const handleDeleteFrameType = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa tipologia?")) {
      try {
        const { error } = await supabase
          .from('frame_types')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setFrameTypes(frameTypes.filter(type => type.id !== id));
        await loadData(); // Ricarica i dati per aggiornare i conteggi
      } catch (error) {
        console.error('Errore nell\'eliminazione della tipologia:', error);
        alert('Errore nell\'eliminazione della tipologia. Riprova più tardi.');
      }
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo profilo?")) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setProfiles(profiles.filter(profile => profile.id !== id));
        await loadData(); // Ricarica i dati per aggiornare i conteggi
      } catch (error) {
        console.error('Errore nell\'eliminazione del profilo:', error);
        alert('Errore nell\'eliminazione del profilo. Riprova più tardi.');
      }
    }
  };

  const handleAddProfileToType = async (frameTypeId: string, profileId: string) => {
    try {
      const { error } = await supabase
        .from('frame_type_profile_rules')
        .insert([{
          frame_type_id: frameTypeId,
          profile_id: profileId,
          height_multiplier: 1,
          width_multiplier: 1
        }]);

      if (error) throw error;

      // Trova il profilo selezionato
      const selectedProfileData = profiles.find(p => p.id === profileId);
      
      // Aggiorna lo stato locale immediatamente
      if (selectedFrameType && selectedProfileData) {
        const newProfile = {
          profileId: profileId,
          profileName: selectedProfileData.name,
          heightMultiplier: 1,
          widthMultiplier: 1
        };
        
        setSelectedFrameType({
          ...selectedFrameType,
          profiles: [...selectedFrameType.profiles, newProfile]
        });
      }

      await loadData(); // Ricarica i dati per aggiornare la vista
      setSelectedProfile("");
    } catch (error) {
      console.error('Errore nell\'aggiunta del profilo:', error);
      alert('Errore nell\'aggiunta del profilo. Riprova più tardi.');
    }
  };

  const handleUpdateMultipliers = async (
    frameTypeId: string,
    profileId: string,
    heightMultiplier: number,
    widthMultiplier: number
  ) => {
    try {
      // Aggiorna lo stato locale immediatamente
      if (selectedFrameType) {
        const updatedProfiles = selectedFrameType.profiles.map(p => 
          p.profileId === profileId 
            ? { ...p, heightMultiplier, widthMultiplier, isDirty: true }
            : p
        );
        setSelectedFrameType({ ...selectedFrameType, profiles: updatedProfiles });
      }
    } catch (error) {
      console.error('Errore nell\'aggiornamento dei moltiplicatori:', error);
      alert('Errore nell\'aggiornamento dei moltiplicatori. Riprova più tardi.');
    }
  };

  const handleSaveFrameType = async () => {
    if (!selectedFrameType) return;

    try {
      // Aggiorna il nome della tipologia
      const { error: updateError } = await supabase
        .from('frame_types')
        .update({ label: selectedFrameType.label })
        .eq('id', selectedFrameType.id);

      if (updateError) throw updateError;

      // Aggiorna i moltiplicatori modificati
      const dirtyProfiles = selectedFrameType.profiles.filter(p => p.isDirty);
      
      for (const profile of dirtyProfiles) {
        const { error } = await supabase
          .from('frame_type_profile_rules')
          .update({
            height_multiplier: profile.heightMultiplier,
            width_multiplier: profile.widthMultiplier
          })
          .eq('frame_type_id', selectedFrameType.id)
          .eq('profile_id', profile.profileId);

        if (error) throw error;
      }

      await loadData();
      setSelectedFrameType(null);
    } catch (error) {
      console.error('Errore nel salvataggio delle modifiche:', error);
      alert('Errore nel salvataggio delle modifiche. Riprova più tardi.');
    }
  };

  const handleRemoveProfileFromType = async (frameTypeId: string, profileId: string) => {
    try {
      const { error } = await supabase
        .from('frame_type_profile_rules')
        .delete()
        .eq('frame_type_id', frameTypeId)
        .eq('profile_id', profileId);

      if (error) throw error;

      // Aggiorna lo stato locale immediatamente
      if (selectedFrameType) {
        const updatedProfiles = selectedFrameType.profiles.filter(
          profile => profile.profileId !== profileId
        );
        setSelectedFrameType({
          ...selectedFrameType,
          profiles: updatedProfiles
        });
      }

      await loadData(); // Ricarica i dati per aggiornare la vista
    } catch (error) {
      console.error('Errore nella rimozione del profilo:', error);
      alert('Errore nella rimozione del profilo. Riprova più tardi.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-xl text-slate-200">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-4 sm:py-8 text-slate-200">
      <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800/40 text-slate-300 hover:text-white rounded-xl backdrop-blur-sm hover:bg-slate-700/40 transition-all duration-300 border border-slate-700/50 hover:border-slate-600/50 shadow-lg hover:shadow-xl"
          >
            <ChevronLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" />
            <span className="font-medium">Home</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <span className="p-2 bg-indigo-500/10 rounded-xl">
              <Square className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-400" />
            </span>
            Tipologie di Serramento
          </h1>
        </div>

        {/* Sezione 1: Elenco delle Tipologie */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 p-4 sm:p-6 mb-4 sm:mb-8 transition-all duration-300 hover:shadow-xl hover:bg-slate-800/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              Tipologie
              <span className="text-sm font-normal text-slate-400">({frameTypes.length})</span>
            </h2>
            <button
              onClick={() => setIsCreateTypeOpen(true)}
              className="w-full sm:w-auto bg-indigo-500 text-white px-4 py-2.5 rounded-xl flex items-center justify-center sm:justify-start gap-2 hover:bg-indigo-600 transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30"
            >
              <PlusIcon className="h-5 w-5" />
              Crea Nuova Tipologia
            </button>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-full inline-block align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-slate-700/50">
                  <thead>
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nome Tipologia</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Profili</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {frameTypes.map((type) => (
                      <tr key={type.id} className="hover:bg-slate-700/30 transition-colors duration-200">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-200">{type.label}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {type.profiles.length} profili
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedFrameType(type)}
                              className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-indigo-500/20 transition-all duration-200"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFrameType(type.id)}
                              className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/20 transition-all duration-200"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Sezione 2: Gestione Profili */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:bg-slate-800/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              Profili
              <span className="text-sm font-normal text-slate-400">({profiles.length})</span>
            </h2>
            <button
              onClick={() => setIsCreateProfileOpen(true)}
              className="w-full sm:w-auto bg-indigo-500 text-white px-4 py-2.5 rounded-xl flex items-center justify-center sm:justify-start gap-2 hover:bg-indigo-600 transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30"
            >
              <PlusIcon className="h-5 w-5" />
              Crea Nuovo Profilo
            </button>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-full inline-block align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-slate-700/50">
                  <thead>
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nome Profilo</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tipologie che lo Usano</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {profiles.map((profile) => (
                      <tr key={profile.id} className="hover:bg-slate-700/30 transition-colors duration-200">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-200">{profile.name}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {profile.usageCount} tipologie
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDeleteProfile(profile.id)}
                              className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/20 transition-all duration-200"
                              title="Elimina profilo"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Modali con sfondo scuro */}
        {(isCreateTypeOpen || selectedFrameType) && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-600/50 relative max-h-[90vh] overflow-y-auto">
              <div className="absolute top-0 right-0 mt-4 mr-4">
                <button
                  onClick={() => {
                    setIsCreateTypeOpen(false);
                    setSelectedFrameType(null);
                    setNewTypeName("");
                  }}
                  className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <h3 className="text-2xl font-bold text-white mb-6">
                {selectedFrameType ? "Modifica Tipologia" : "Crea Nuova Tipologia"}
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Nome Tipologia</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border-0 bg-slate-800/50 shadow-inner shadow-black/20 py-3 px-4 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="es. Battente 1 Anta"
                    value={selectedFrameType ? selectedFrameType.label : newTypeName}
                    onChange={(e) => selectedFrameType ? 
                      setSelectedFrameType({...selectedFrameType, label: e.target.value}) : 
                      setNewTypeName(e.target.value)
                    }
                  />
                </div>

                {selectedFrameType && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Profili Associati</label>
                    <div className="flex gap-2">
                      <select
                        className="w-full rounded-xl border-0 bg-slate-800/50 shadow-inner shadow-black/20 py-3 px-4 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={selectedProfile}
                        onChange={(e) => setSelectedProfile(e.target.value)}
                      >
                        <option value="">Seleziona un profilo</option>
                        {profiles
                          .filter(p => !selectedFrameType.profiles.some(sp => sp.profileId === p.id))
                          .map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => {
                          if (selectedProfile) {
                            handleAddProfileToType(selectedFrameType.id, selectedProfile);
                          }
                        }}
                        disabled={!selectedProfile}
                        className={`px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-all duration-200 ${
                          selectedProfile 
                            ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30' 
                            : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <PlusIcon className="h-5 w-5" />
                        Aggiungi
                      </button>
                    </div>
                  </div>
                )}

                {selectedFrameType?.profiles.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-slate-600/50 bg-slate-800/50">
                    <div className="sm:hidden">
                      {/* Vista Mobile */}
                      <div className="divide-y divide-slate-600/50">
                        {selectedFrameType.profiles.map((assignment) => (
                          <div key={assignment.profileId} className="p-4 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-white font-medium">{assignment.profileName}</span>
                              <button
                                onClick={() => handleRemoveProfileFromType(selectedFrameType.id, assignment.profileId)}
                                className="text-rose-300 hover:text-rose-200 p-2 rounded-lg hover:bg-rose-500/20 transition-all duration-200"
                                title="Rimuovi profilo"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Moltiplicatore Altezza</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  className="w-full rounded-lg border-0 bg-slate-800/80 shadow-inner shadow-black/20 py-2 px-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all"
                                  value={assignment.heightMultiplier}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) {
                                      handleUpdateMultipliers(
                                        selectedFrameType.id,
                                        assignment.profileId,
                                        value,
                                        assignment.widthMultiplier
                                      );
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Moltiplicatore Larghezza</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  className="w-full rounded-lg border-0 bg-slate-800/80 shadow-inner shadow-black/20 py-2 px-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all"
                                  value={assignment.widthMultiplier}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) {
                                      handleUpdateMultipliers(
                                        selectedFrameType.id,
                                        assignment.profileId,
                                        assignment.heightMultiplier,
                                        value
                                      );
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Vista Desktop - Tabella esistente */}
                    <div className="hidden sm:block">
                      <table className="min-w-full divide-y divide-slate-600/50">
                        <thead className="bg-slate-700/50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Profilo</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Molt. Altezza</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Molt. Larghezza</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-600/50">
                          {selectedFrameType.profiles.map((assignment) => (
                            <tr key={assignment.profileId} className="hover:bg-slate-700/50 transition-all duration-200">
                              <td className="px-6 py-4 text-white font-medium">{assignment.profileName}</td>
                              <td className="px-6 py-4">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  className="w-28 rounded-lg border-0 bg-slate-800/80 shadow-inner shadow-black/20 py-2 px-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all"
                                  value={assignment.heightMultiplier}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) {
                                      handleUpdateMultipliers(
                                        selectedFrameType.id,
                                        assignment.profileId,
                                        value,
                                        assignment.widthMultiplier
                                      );
                                    }
                                  }}
                                />
                              </td>
                              <td className="px-6 py-4">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  className="w-28 rounded-lg border-0 bg-slate-800/80 shadow-inner shadow-black/20 py-2 px-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all"
                                  value={assignment.widthMultiplier}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) {
                                      handleUpdateMultipliers(
                                        selectedFrameType.id,
                                        assignment.profileId,
                                        assignment.heightMultiplier,
                                        value
                                      );
                                    }
                                  }}
                                />
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handleRemoveProfileFromType(selectedFrameType.id, assignment.profileId)}
                                  className="text-rose-300 hover:text-rose-200 p-2 rounded-lg hover:bg-rose-500/20 transition-all duration-200"
                                  title="Rimuovi profilo"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-6">
                  <button
                    onClick={() => {
                      setIsCreateTypeOpen(false);
                      setSelectedFrameType(null);
                      setNewTypeName("");
                    }}
                    className="px-6 py-3 border-2 border-slate-600 rounded-xl text-white hover:bg-slate-700/50 transition-all duration-200 font-medium"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => {
                      if (selectedFrameType) {
                        handleSaveFrameType();
                      } else {
                        handleCreateFrameType();
                      }
                    }}
                    className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 font-medium"
                  >
                    Salva
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isCreateProfileOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-8 w-full max-w-md shadow-2xl border border-slate-600/50 relative">
              <div className="absolute top-0 right-0 mt-4 mr-4">
                <button
                  onClick={() => {
                    setIsCreateProfileOpen(false);
                    setNewProfileName("");
                  }}
                  className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <h3 className="text-2xl font-bold text-white mb-6">Crea Nuovo Profilo</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Nome Profilo</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border-0 bg-slate-800/50 shadow-inner shadow-black/20 py-3 px-4 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="es. Telaio"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-4 pt-6">
                  <button
                    onClick={() => {
                      setIsCreateProfileOpen(false);
                      setNewProfileName("");
                    }}
                    className="px-6 py-3 border-2 border-slate-600 rounded-xl text-white hover:bg-slate-700/50 transition-all duration-200 font-medium"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleCreateProfile}
                    className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 font-medium"
                  >
                    Salva
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FrametypesPage; 