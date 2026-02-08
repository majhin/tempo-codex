# Tempo Clone - Time Tracking App with DevExtreme React Scheduler

A comprehensive time tracking application inspired by Tempo, built with React and DevExtreme Scheduler component.

## Features

### 📅 Calendar & Scheduling
- **Multiple Views**: Day, Week, Work Week, and Month views
- **Drag & Drop**: Easily reschedule appointments by dragging
- **Resize**: Adjust time duration by resizing appointments
- **Quick Add**: Click any time slot to create a new work log

### ⏱️ Time Tracking
- **Work Logs**: Track time spent on different tasks
- **Project Assignment**: Categorize work by projects
- **Task Types**: Classify work (Development, Meeting, Bug Fix, etc.)
- **Automatic Calculation**: Hours are automatically calculated from start/end times

### 📊 Analytics & Reports
- **Daily Summary**: See total hours logged today
- **Weekly Summary**: Track weekly time totals
- **Project Breakdown**: View time spent per project
- **Visual Color Coding**: Easy identification with color-coded projects

### 🎨 UI/UX Features
- Modern, clean interface inspired by Tempo
- Responsive design
- Custom appointment templates with project and time info
- Detailed tooltips on hover
- Color-coded projects and task types
- Statistics dashboard

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Steps

1. **Install dependencies**
```bash
npm install
```

2. **Run the development server**
```bash
npm run dev
```

3. **Open your browser**
The app will automatically open at `http://localhost:3000`

## Project Structure

```
├── src/
│   ├── components/
│   │   └── Scheduler/
│   │       ├── Scheduler.jsx   # Main scheduler component
│   │       └── Scheduler.css   # Scheduler styles
│   ├── App.jsx                 # App wrapper
│   └── main.jsx                # React entry point
├── index.html          # HTML template
├── package.json        # Dependencies
├── vite.config.js      # Vite configuration
└── README.md           # This file
```

## Key Components

### Data Structure

Each work log entry contains:
```javascript
{
  id: 1,
  text: 'Task name',
  startDate: Date,
  endDate: Date,
  projectId: 1,
  taskType: 'development',
  description: 'Detailed description',
  timeSpent: 2.5  // hours
}
```

### Projects
- Project Alpha (Blue)
- Project Beta (Green)
- Project Gamma (Orange)
- Internal Tasks (Purple)

### Task Types
- Development
- Meeting
- Code Review
- Bug Fix
- Documentation
- Testing

## Usage Guide

### Adding a Work Log
1. Click on any time slot in the scheduler
2. Fill in the task details
3. Select project and task type
4. Set start and end times
5. Click "Save"

### Editing a Work Log
1. Click on an existing appointment
2. Modify the details in the popup
3. Click "Save" to update

### Deleting a Work Log
1. Click on the appointment
2. Click the delete button in the popup

### Rescheduling
- **Drag**: Click and drag an appointment to a new time
- **Resize**: Drag the top or bottom edge to adjust duration

### Viewing Statistics
- **Today's Hours**: Displayed in the blue card (top right)
- **Weekly Hours**: Displayed in the green card (top right)
- **Project Totals**: Shown in cards at the bottom

## Customization

### Adding New Projects
Edit the `projects` array in `src/components/Scheduler/Scheduler.jsx`:
```javascript
const projects = [
  { id: 5, text: 'New Project', color: '#ec4899' }
];
```

### Adding Task Types
Edit the `taskTypes` array:
```javascript
const taskTypes = [
  { id: 'design', text: 'Design', color: '#f472b6' }
];
```

### Changing Work Hours
Modify the scheduler hours in the Scheduler component:
```javascript
startDayHour={8}  // Start at 8 AM
endDayHour={19}   // End at 7 PM
```

### Styling
The component uses inline styles for easy customization. You can:
- Change colors by modifying the color values
- Adjust spacing by changing padding/margin values
- Modify the layout by updating flexbox properties

## DevExtreme Scheduler Features Used

- **Multiple Views**: Day, Week, WorkWeek, Month
- **Editing**: Add, Update, Delete, Resize, Drag
- **Resources**: Project and Task Type categorization
- **Custom Templates**: Appointment and tooltip templates
- **Time Calculation**: Automatic hour tracking
- **Event Handling**: Add, update, delete callbacks

## Tips & Best Practices

1. **Time Entry**: Log time daily for accuracy
2. **Project Assignment**: Always assign work to a project
3. **Task Classification**: Use appropriate task types
4. **Regular Reviews**: Check weekly summaries
5. **Detailed Descriptions**: Add context to work logs

## Future Enhancements

Potential features to add:
- [ ] Export to CSV/Excel
- [ ] Reporting dashboard
- [ ] Integration with Jira/project management tools
- [ ] Team view (multi-user)
- [ ] Time approval workflow
- [ ] Mobile responsive improvements
- [ ] Dark mode
- [ ] Calendar sync (Google Calendar, Outlook)
- [ ] Recurring appointments
- [ ] Time estimates vs actuals

## Technologies

- **React 18**: UI framework
- **DevExtreme**: Scheduler component library
- **Vite**: Build tool and dev server
- **JavaScript/JSX**: Programming language

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This is a demo application for educational purposes.

## Support

For DevExtreme documentation, visit:
- [DevExtreme Scheduler](https://js.devexpress.com/React/Documentation/Guide/UI_Components/Scheduler/Getting_Started_with_Scheduler/)
- [DevExtreme React Guide](https://js.devexpress.com/React/Documentation/Guide/React_Components/Application_Template/)

## Troubleshooting

### Issue: Scheduler not displaying
- Ensure DevExtreme CSS is imported correctly
- Check that all dependencies are installed

### Issue: Appointments not saving
- Verify the appointment data structure matches the expected format
- Check console for errors

### Issue: Styling issues
- Clear browser cache
- Ensure `dx.light.css` is loaded

---

Built with ❤️ using DevExtreme React Scheduler
