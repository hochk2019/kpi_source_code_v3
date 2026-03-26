import SharedStaffCombobox from "@/components/shared/StaffCombobox.jsx";

export default function MstAssignmentStaffCombobox(props) {
  return (
    <SharedStaffCombobox
      {...props}
      allowCustom
      preserveTeamOnCustom
      preserveTeamOnClear
    />
  );
}
